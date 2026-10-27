/**
 * The upload and download handlers themselves — where an interrupted transfer
 * either gets caught or quietly becomes a broken movie.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import { bytesOnDisk, weekFilePath } from "@/lib/week-files";
import { PUT } from "@/app/api/weeks/[weekId]/file/chunk/route";
import { GET } from "@/app/api/weeks/[weekId]/file/route";

vi.mock("@/lib/db", () => ({
  db: {
    weekFile: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/app/actions/user", () => ({ getActiveUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const FILE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const uploader = { id: "user-1", name: "Stew", role: "USER", isApproved: true };

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function slowStreamOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      for (const ch of text) {
        await new Promise((r) => setTimeout(r, 1));
        controller.enqueue(new TextEncoder().encode(ch));
      }
      controller.close();
    },
  });
}

const params = { params: Promise.resolve({ weekId: "week-1" }) };

/** Only the three things the handler reads off a request. */
function chunkRequest(opts: {
  uploadId?: string;
  offset: number;
  body: string;
  hash?: string | null;
  slow?: boolean;
}): Request {
  const uploadId = opts.uploadId ?? FILE_ID;
  const hash = opts.hash === undefined ? sha256(opts.body) : opts.hash;
  return {
    url: `http://localhost/api/weeks/week-1/file/chunk?uploadId=${uploadId}&offset=${opts.offset}`,
    headers: new Headers(hash === null ? {} : { "x-chunk-sha256": hash }),
    body: opts.slow ? slowStreamOf(opts.body) : streamOf(opts.body),
  } as unknown as Request;
}

function downloadRequest(range?: string): Request {
  return {
    url: "http://localhost/api/weeks/week-1/file",
    headers: new Headers(range ? { range } : {}),
  } as unknown as Request;
}

/** An in-progress upload row of `size` bytes owned by the uploader. */
function row(size: number, extra: Record<string, unknown> = {}) {
  return {
    id: FILE_ID,
    weekId: "week-1",
    uploadedById: uploader.id,
    originalName: "movie.mkv",
    size: BigInt(size),
    completedAt: null,
    contentHash: null,
    updatedAt: new Date(),
    ...extra,
  };
}

let dir: string;

beforeEach(() => {
  vi.clearAllMocks();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "week-file-routes-"));
  process.env.MOVIE_FILES_DIR = dir;
  vi.mocked(getActiveUser).mockResolvedValue(uploader as any);
  vi.mocked(db.weekFile.update).mockResolvedValue({} as any);
  vi.mocked(db.weekFile.updateMany).mockResolvedValue({ count: 1 } as any);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.MOVIE_FILES_DIR;
});

describe("PUT chunk", () => {
  it("refuses a chunk that arrives without a digest", async () => {
    vi.mocked(db.weekFile.findUnique).mockResolvedValue(row(10) as any);

    const res = await PUT(chunkRequest({ offset: 0, body: "0123456789", hash: null }), params);

    expect(res.status).toBe(400);
    expect(bytesOnDisk(FILE_ID)).toBe(0);
  });

  it("stores a chunk that matches its digest", async () => {
    vi.mocked(db.weekFile.findUnique).mockResolvedValue(row(10) as any);

    const res = await PUT(chunkRequest({ offset: 0, body: "01234" }), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: 5, done: false });
    expect(fs.readFileSync(weekFilePath(FILE_ID), "utf8")).toBe("01234");
    // Not finished, so no completion recorded.
    expect(db.weekFile.update).toHaveBeenCalledWith({
      where: { id: FILE_ID },
      data: { completedAt: null },
    });
  });

  it("rejects a chunk corrupted in transit and leaves the file as it was", async () => {
    vi.mocked(db.weekFile.findUnique).mockResolvedValue(row(20) as any);
    await PUT(chunkRequest({ offset: 0, body: "intact" }), params);

    // What arrived is not what the uploader hashed.
    const res = await PUT(
      chunkRequest({ offset: 6, body: "damaged", hash: sha256("what was sent") }),
      params
    );

    expect(res.status).toBe(422);
    // The offset it reports is where the client should resume from.
    expect(await res.json()).toMatchObject({ received: 6 });
    expect(fs.readFileSync(weekFilePath(FILE_ID), "utf8")).toBe("intact");
    expect(db.weekFile.update).toHaveBeenCalledTimes(1);
  });

  it("marks the upload finished once the file on disk is the declared size", async () => {
    vi.mocked(db.weekFile.findUnique).mockResolvedValue(row(8) as any);

    const res = await PUT(chunkRequest({ offset: 0, body: "complete" }), params);

    expect(await res.json()).toEqual({ received: 8, done: true });
    expect(db.weekFile.update).toHaveBeenCalledWith({
      where: { id: FILE_ID },
      data: { completedAt: expect.any(Date) },
    });
    // The whole-file hash is recorded after the response, not during it.
    await vi.waitFor(() =>
      expect(db.weekFile.updateMany).toHaveBeenCalledWith({
        where: { id: FILE_ID },
        data: { contentHash: sha256("complete") },
      })
    );
  });

  it("does not interleave a retry that arrives while the first write is running", async () => {
    // The interruption case: the client gave up on a request the server is
    // still writing, and sent the same chunk again from the same offset.
    vi.mocked(db.weekFile.findUnique).mockResolvedValue(row(16) as any);

    const [first, second] = await Promise.all([
      PUT(chunkRequest({ offset: 0, body: "AAAAAAAA", slow: true }), params),
      PUT(chunkRequest({ offset: 0, body: "BBBBBBBB", slow: true }), params),
    ]);

    expect(first.status).toBe(200);
    // The second one waited, then found the offset had moved on.
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ received: 8 });

    // One chunk's bytes, whole and in order — never a mixture of the two.
    expect(fs.readFileSync(weekFilePath(FILE_ID), "utf8")).toBe("AAAAAAAA");
  });

  it("refuses a chunk aimed at an upload that was replaced", async () => {
    vi.mocked(db.weekFile.findUnique).mockResolvedValue(row(10, { id: "99999999-9999-9999-9999-999999999999" }) as any);

    const res = await PUT(chunkRequest({ offset: 0, body: "bytes" }), params);

    expect(res.status).toBe(410);
    expect(bytesOnDisk(FILE_ID)).toBe(0);
  });

  it("refuses a chunk for someone else's upload", async () => {
    vi.mocked(db.weekFile.findUnique).mockResolvedValue(row(10, { uploadedById: "someone-else" }) as any);

    const res = await PUT(chunkRequest({ offset: 0, body: "bytes" }), params);

    expect(res.status).toBe(403);
    expect(bytesOnDisk(FILE_ID)).toBe(0);
  });
});

describe("GET download", () => {
  function writeFinished(content: string, declaredSize = content.length) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(weekFilePath(FILE_ID), content);
    vi.mocked(db.weekFile.findUnique).mockResolvedValue(
      row(declaredSize, { completedAt: new Date(), contentHash: sha256(content) }) as any
    );
  }

  it("serves a complete file", async () => {
    writeFinished("the whole movie");

    const res = await GET(downloadRequest(), params);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("15");
    expect(res.headers.get("x-content-sha256")).toBe(sha256("the whole movie"));
    expect(await res.text()).toBe("the whole movie");
  });

  it("refuses a file that is shorter on disk than its row declares", async () => {
    // What a restart mid-upload leaves behind: a row that says the upload
    // finished over a file that is missing its tail.
    writeFinished("half a mov", 20);

    const res = await GET(downloadRequest(), params);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/incomplete/i);
  });

  it("refuses a file that is longer on disk than its row declares", async () => {
    writeFinished("more than declared", 5);

    expect((await GET(downloadRequest(), params)).status).toBe(409);
  });

  it("serves a byte range so a download can resume", async () => {
    writeFinished("0123456789");

    const res = await GET(downloadRequest("bytes=4-6"), params);

    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 4-6/10");
    expect(await res.text()).toBe("456");
  });

  it("still refuses a range request on a file whose length is wrong", async () => {
    writeFinished("0123456789", 20);

    expect((await GET(downloadRequest("bytes=0-3"), params)).status).toBe(409);
  });
});
