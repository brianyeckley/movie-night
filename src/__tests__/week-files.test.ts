import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import { appendChunk, bytesOnDisk, ChunkTooLargeError, removeWeekFile, weekFilePath } from "@/lib/week-files";
import { deleteWeekFileAction } from "@/app/actions/weekFile";
import { completeWeekAction } from "@/app/actions/week";

vi.mock("@/lib/db", () => ({
  db: {
    weekFile: { findUnique: vi.fn(), delete: vi.fn() },
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

function streamOf(...parts: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const p of parts) controller.enqueue(new TextEncoder().encode(p));
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
    expect(await appendChunk(FILE_ID, streamOf("hello "), 100)).toBe(6);
    expect(await appendChunk(FILE_ID, streamOf("wor", "ld"), 100)).toBe(11);
    expect(fs.readFileSync(weekFilePath(FILE_ID), "utf8")).toBe("hello world");
  });

  it("rejects an oversized chunk and truncates it back off", async () => {
    await appendChunk(FILE_ID, streamOf("abc"), 100);
    await expect(appendChunk(FILE_ID, streamOf("12345", "678"), 5)).rejects.toBeInstanceOf(ChunkTooLargeError);
    expect(bytesOnDisk(FILE_ID)).toBe(3);
  });

  it("truncates a chunk whose connection drops part way through", async () => {
    await appendChunk(FILE_ID, streamOf("abc"), 100);
    const dropped = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("partial"));
        controller.error(new Error("connection reset"));
      },
    });
    await expect(appendChunk(FILE_ID, dropped, 100)).rejects.toThrow();
    expect(bytesOnDisk(FILE_ID)).toBe(3);
  });

  it("refuses ids that could escape the storage directory", () => {
    expect(() => weekFilePath("../dev.db")).toThrow("Invalid file id.");
  });

  it("removeWeekFile deletes both the row and the bytes", async () => {
    await appendChunk(FILE_ID, streamOf("data"), 100);
    vi.mocked(db.weekFile.findUnique).mockResolvedValueOnce({ id: FILE_ID } as any);
    await removeWeekFile("week-1");
    expect(db.weekFile.delete).toHaveBeenCalledWith({ where: { id: FILE_ID } });
    expect(fs.existsSync(weekFilePath(FILE_ID))).toBe(false);
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
    await appendChunk(FILE_ID, streamOf("movie"), 100);
    vi.mocked(getActiveUser).mockResolvedValueOnce(admin as any);
    vi.mocked(db.movieNightWeek.findUnique).mockResolvedValueOnce({ id: "week-1", winningMovieId: "m-1" } as any);
    vi.mocked(db.movie.findUnique).mockResolvedValueOnce({ id: "m-1", category: { name: "Other" } } as any);
    vi.mocked(db.weekFile.findUnique).mockResolvedValueOnce({ id: FILE_ID } as any);

    await completeWeekAction("week-1", false);

    expect(db.weekFile.delete).toHaveBeenCalledWith({ where: { id: FILE_ID } });
    expect(fs.existsSync(weekFilePath(FILE_ID))).toBe(false);
  });
});
