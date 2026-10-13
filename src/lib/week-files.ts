/**
 * Storage for the one file attached to a week's winning movie.
 *
 * Files are large (whole movies), so they are never held in memory: uploads
 * arrive as a series of chunks appended straight to disk, and downloads are
 * streamed back out. Chunking keeps every request under Cloudflare's 100 MB
 * request-body limit, which a single upload through the tunnel would hit.
 *
 * On disk a file is named by its WeekFile row id, never the original name.
 */

import fs from "fs";
import path from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { db } from "@/lib/db";

/** Each chunk the browser sends. Well under Cloudflare's 100 MB body limit. */
export const CHUNK_SIZE = 32 * 1024 * 1024;

/**
 * How long an unfinished upload holds the slot before someone else can start
 * over it. Covers an uploader who closed the tab half way through.
 */
export const STALE_UPLOAD_MS = 10 * 60 * 1000;

/** Where files live. Set MOVIE_FILES_DIR to point this at a mounted volume. */
export function weekFilesDir(): string {
  return process.env.MOVIE_FILES_DIR || path.join(process.cwd(), "data/movie-files");
}

/** The on-disk path for a WeekFile row id. */
export function weekFilePath(fileId: string): string {
  // Ids are server-generated UUIDs; refuse anything that could leave the dir.
  if (!/^[0-9a-f-]+$/i.test(fileId)) throw new Error("Invalid file id.");
  return path.join(weekFilesDir(), fileId);
}

/** Bytes written so far, or 0 when nothing has arrived yet. */
export function bytesOnDisk(fileId: string): number {
  try {
    return fs.statSync(weekFilePath(fileId)).size;
  } catch {
    return 0;
  }
}

export function deleteWeekFileFromDisk(fileId: string): void {
  try {
    fs.unlinkSync(weekFilePath(fileId));
  } catch {
    // Already gone, or never existed — nothing left to clean up.
  }
}

export class ChunkTooLargeError extends Error {}

/**
 * Appends a request body to the file, stopping if it would exceed `maxBytes`.
 *
 * A failed or oversized chunk is truncated back off again, so the file on
 * disk only ever holds whole chunks and the client can retry from the offset.
 * Returns the file's new size.
 */
export async function appendChunk(
  fileId: string,
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<number> {
  const filePath = weekFilePath(fileId);
  fs.mkdirSync(weekFilesDir(), { recursive: true });
  const startSize = bytesOnDisk(fileId);

  let received = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _enc, callback) {
      received += chunk.length;
      if (received > maxBytes) {
        callback(new ChunkTooLargeError("Upload is larger than the file size it declared."));
      } else {
        callback(null, chunk);
      }
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as import("stream/web").ReadableStream<Uint8Array>),
      limit,
      fs.createWriteStream(filePath, { flags: "a" })
    );
  } catch (err) {
    try {
      fs.truncateSync(filePath, startSize);
    } catch {
      // The file may not exist if nothing was ever written.
    }
    throw err;
  }

  return startSize + received;
}

/**
 * Removes a week's file, both the row and the bytes on disk.
 *
 * Called when a week is closed or deleted, so the drive does not fill up
 * with movies nobody needs any more. Safe to call when there is no file.
 */
export async function removeWeekFile(weekId: string): Promise<void> {
  const file = await db.weekFile.findUnique({ where: { weekId } });
  if (!file) return;
  await db.weekFile.delete({ where: { id: file.id } });
  deleteWeekFileFromDisk(file.id);
}
