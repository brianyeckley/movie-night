import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import {
  ChunkHashMismatchError,
  ChunkTooLargeError,
  appendChunk,
  bytesOnDisk,
  removeWeekFile,
  storeContentHash,
  weekFilePath,
  withFileLock,
} from "@/lib/week-files";
import { deleteWeekFileAction } from "@/app/actions/weekFile";
import { completeWeekAction } from "@/app/actions/week";

vi.mock("@/lib/db", () => ({
  db: {
    weekFile: { findUnique: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
    movieNightWeek: { findUnique: vi.fn(), update: vi.fn() },
    movie: { findUnique: vi.fn(), update: vi.fn() },
    category: { findUnique: vi.fn() },
  },
}));
vi.mock("@/app/actions/user", () => ({ getActiveUser: vi.fn() }));
vi.mock("@/lib/discord", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const FILE_ID = "11111111-2222-3333-4444-555555555555";
const admin = { id: "admin-1", username: "brian", name: "Brian", passwordHash: "", role: "ADMIN", isApproved: true };
const uploader = { id: "user-1", username: "stew", name: "Stew", passwordHash: "", role: "USER", isApproved: true };
const otherUser = { id: "user-2", username: "nick", name: "Nick", passwordHash: "", role: "USER", isApproved: true };

/** The digest the uploader is expected to send with these bytes. */
function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function streamOf(...parts: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const p of parts) controller.enqueue(new TextEncoder().encode(p));
      controller.close();
    },
  });
}

/** Yields a byte at a time, so two writes can genuinely overlap. */
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

let dir: string;

beforeEach(() => {
  vi.clearAllMocks();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "week-files-"));
  process.env.MOVIE_FILES_DIR = dir;
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.MOVIE_FILES_DIR;
});

describe("week file storage", () => {
  it("appends chunks in order", async () => {
    expect(await appendChunk(FILE_ID, streamOf("hello "), 100, sha256("hello "))).toBe(6);
    expect(await appendChunk(FILE_ID, streamOf("wor", "ld"), 100, sha256("world"))).toBe(11);
    expect(fs.readFileSync(weekFilePath(FILE_ID), "utf8")).toBe("hello world");
  });

  it("reports the size it reads back from disk, not what it meant to write", async () => {
    // Something else already put bytes down that this caller never saw.
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(weekFilePath(FILE_ID), "xxxx");
    expect(await appendChunk(FILE_ID, streamOf("yy"), 100, sha256("yy"))).toBe(6);
  });

  it("rejects an oversized chunk and truncates it back off", async () => {
    await appendChunk(FILE_ID, streamOf("abc"), 100, sha256("abc"));
    await expect(
      appendChunk(FILE_ID, streamOf("12345", "678"), 5, sha256("12345678"))
    ).rejects.toBeInstanceOf(ChunkTooLargeError);
    expect(bytesOnDisk(FILE_ID)).toBe(3);
  });

  it("truncates a chunk whose connection drops part way through", async () => {
    await appendChunk(FILE_ID, streamOf("abc"), 100, sha256("abc"));
    const dropped = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("partial"));
        controller.error(new Error("connection reset"));
      },
    });
    await expect(appendChunk(FILE_ID, dropped, 100, sha256("partial"))).rejects.toThrow();
    expect(bytesOnDisk(FILE_ID)).toBe(3);
  });

  it("refuses ids that could escape the storage directory", () => {
    expect(() => weekFilePath("../dev.db")).toThrow("Invalid file id.");
  });

  it("removeWeekFile deletes both the row and the bytes", async () => {
    await appendChunk(FILE_ID, streamOf("data"), 100, sha256("data"));
    vi.mocked(db.weekFile.findUnique).mockResolvedValueOnce({ id: FILE_ID } as any);
    await removeWeekFile("week-1");
    expect(db.weekFile.delete).toHaveBeenCalledWith({ where: { id: FILE_ID } });
    expect(fs.existsSync(weekFilePath(FILE_ID))).toBe(false);
  });
});

describe("chunk integrity", () => {
  it("throws away a chunk whose bytes do not match the digest sent with it", async () => {
    await appendChunk(FILE_ID, streamOf("good"), 100, sha256("good"));

    await expect(
      appendChunk(FILE_ID, streamOf("corrupted"), 100, sha256("what was sent"))
    ).rejects.toBeInstanceOf(ChunkHashMismatchError);

    // The damaged bytes are off the file again, so the client can resend.
    expect(bytesOnDisk(FILE_ID)).toBe(4);
    expect(fs.readFileSync(weekFilePath(FILE_ID), "utf8")).toBe("good");
  });

  it("keeps a resent chunk once it arrives intact", async () => {
    await expect(
      appendChunk(FILE_ID, streamOf("payload"), 100, sha256("mangled"))
    ).rejects.toBeInstanceOf(ChunkHashMismatchError);
    expect(await appendChunk(FILE_ID, streamOf("payload"), 100, sha256("payload"))).toBe(7);
    expect(fs.readFileSync(weekFilePath(FILE_ID), "utf8")).toBe("payload");
  });
});

describe("withFileLock", () => {
  it("keeps two overlapping writes from interleaving their bytes", async () => {
    // Both of these would otherwise pass the offset check at 0 and append at
    // the same time, which produced files like "ABABABABABABABAB".
    const write = (text: string) =>
      withFileLock(FILE_ID, () => appendChunk(FILE_ID, slowStreamOf(text), 1024, sha256(text)));

    await Promise.all([write("AAAAAAAA"), write("BBBBBBBB")]);

    const content = fs.readFileSync(weekFilePath(FILE_ID), "utf8");
    expect(content).toBe("AAAAAAAABBBBBBBB");
    expect(bytesOnDisk(FILE_ID)).toBe(16);
  });

  it("runs the next waiter after one in front of it fails", async () => {
    const failed = withFileLock(FILE_ID, async () => {
      throw new Error("chunk failed");
    });
    await expect(failed).rejects.toThrow("chunk failed");

    const size = await withFileLock(FILE_ID, () =>
      appendChunk(FILE_ID, streamOf("after"), 100, sha256("after"))
    );
    expect(size).toBe(5);
  });
});

describe("storeContentHash", () => {
  it("records the SHA-256 of the finished file", async () => {
    await appendChunk(FILE_ID, streamOf("the whole movie"), 100, sha256("the whole movie"));

    await storeContentHash(FILE_ID);

    expect(db.weekFile.updateMany).toHaveBeenCalledWith({
      where: { id: FILE_ID },
      data: { contentHash: sha256("the whole movie") },
    });
  });

  it("does not throw when the file is already gone", async () => {
    await expect(storeContentHash(FILE_ID)).resolves.toBeUndefined();
    expect(db.weekFile.updateMany).not.toHaveBeenCalled();
  });
});

describe("deleteWeekFileAction", () => {
  beforeEach(() => {
    vi.mocked(db.weekFile.findUnique).mockResolvedValue({ id: FILE_ID, uploadedById: uploader.id } as any);
  });

  it("lets the uploader delete their file", async () => {
    vi.mocked(getActiveUser).mockResolvedValueOnce(uploader as any);
    expect(await deleteWeekFileAction("week-1")).toEqual({ success: true });
    expect(db.weekFile.delete).toHaveBeenCalled();
  });

  it("lets an admin delete anyone's file", async () => {
    vi.mocked(getActiveUser).mockResolvedValueOnce(admin as any);
    expect(await deleteWeekFileAction("week-1")).toEqual({ success: true });
    expect(db.weekFile.delete).toHaveBeenCalled();
  });

  it("refuses other users", async () => {
    vi.mocked(getActiveUser).mockResolvedValueOnce(otherUser as any);
    const result = await deleteWeekFileAction("week-1");
    expect(result.success).toBe(false);
    expect(db.weekFile.delete).not.toHaveBeenCalled();
  });
});

describe("closing a week", () => {
  it("deletes the week's file", async () => {
    await appendChunk(FILE_ID, streamOf("movie"), 100, sha256("movie"));
    vi.mocked(getActiveUser).mockResolvedValueOnce(admin as any);
    vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({ id: "week-1", winningMovieId: "m-1" } as any);
    vi.mocked(db.movie.findUnique).mockResolvedValueOnce({ id: "m-1", category: { name: "Other" } } as any);
    vi.mocked(db.weekFile.findUnique).mockResolvedValueOnce({ id: FILE_ID } as any);

    await completeWeekAction("week-1", false);

    expect(db.weekFile.delete).toHaveBeenCalledWith({ where: { id: FILE_ID } });
    expect(fs.existsSync(weekFilePath(FILE_ID))).toBe(false);
  });
});
