/**
 * Storage for the one file attached to a week's winning movie.
 *
 * Files are large (whole movies), so they are never held in memory: uploads
 * arrive as a series of chunks appended straight to disk, and downloads are
 * streamed back out. Chunking keeps every request under Cloudflare's 100 MB
 * request-body limit, which a single upload through the tunnel would hit.
 *
 * On disk a file is named by its WeekFile row id, never the original name.
 *
 * Nothing here trusts a byte count it did not read from the disk, because a
 * movie that is subtly wrong is worse than one that failed outright:
 *
 * - Every chunk carries a SHA-256 of its own bytes and is verified before it
 *   counts. A chunk that does not match is truncated back off, so the client
 *   resends it rather than the damage reaching the finished file.
 * - Writes to one file are serialised with `withFileLock`. Appending is only
 *   atomic per write, not per request, so two overlapping requests would
 *   interleave their bytes -- which is what an interrupted upload's retry
 *   used to do while the abandoned write was still running.
 * - Accepted bytes are fsync'd before the client is told they arrived, since
 *   Watchtower restarts this container on its own schedule.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { db } from "@/lib/db";

/**
 * The chunk size the browser is told to use. Small enough that a connection
 * that drops near the end of one only costs that much to send again, which is
 * the case worth optimising for -- flaky links are where this gets used.
 */
export const CHUNK_SIZE = 8 * 1024 * 1024;

/**
 * The largest single request body a chunk may carry, which is deliberately
 * larger than what we ask for: a tab that loaded before CHUNK_SIZE last
 * changed is still sending the old size, and its upload should not fail
 * halfway. Still far under Cloudflare's 100 MB request-body limit.
 */
export const MAX_CHUNK_BYTES = 32 * 1024 * 1024;

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

/** Size and last-write time of the bytes on disk, or null if there are none. */
export function fileStats(fileId: string): { size: number; mtimeMs: number } | null {
  try {
    const stat = fs.statSync(weekFilePath(fileId));
    return { size: stat.size, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

/** Bytes written so far, or 0 when nothing has arrived yet. */
export function bytesOnDisk(fileId: string): number {
  return fileStats(fileId)?.size ?? 0;
}

/**
 * When an upload last got somewhere: a chunk recorded, or bytes written.
 *
 * `updatedAt` only moves when a chunk *finishes*, so on a slow connection a
 * single chunk can outlast STALE_UPLOAD_MS and the upload gets declared
 * abandoned while it is actively running. The file's own mtime advances the
 * whole time bytes are arriving, so taking the later of the two measures
 * progress rather than how long the current chunk is taking.
 */
export function lastProgressAt(file: { id: string; updatedAt: Date }): number {
  return Math.max(file.updatedAt.getTime(), fileStats(file.id)?.mtimeMs ?? 0);
}

export function deleteWeekFileFromDisk(fileId: string): void {
  try {
    fs.unlinkSync(weekFilePath(fileId));
  } catch {
    // Already gone, or never existed — nothing left to clean up.
  }
}

export class ChunkTooLargeError extends Error {}
export class ChunkHashMismatchError extends Error {}

/**
 * Runs `fn` with nothing else writing to the same file.
 *
 * A chunk request has to read the file's length, append to it, and record the
 * result as one step: two requests that each read the same length both append,
 * and the file ends up holding their bytes shuffled together. The client
 * uploads sequentially, but a retry after a lost response arrives while the
 * abandoned write is often still running, which is exactly that case.
 *
 * One process holds every upload (a single Next server), so a module-level map
 * is enough. Several app instances sharing a disk would need a real lock.
 */
const fileLocks = new Map<string, Promise<unknown>>();

export function withFileLock<T>(fileId: string, fn: () => Promise<T>): Promise<T> {
  const previous = fileLocks.get(fileId) ?? Promise.resolve();
  // Run next whether the request ahead succeeded or failed.
  const run = previous.then(fn, fn);
  // The queue itself must never reject, or every later waiter inherits it.
  const link = run.catch(() => {});
  fileLocks.set(fileId, link);
  void link.then(() => {
    if (fileLocks.get(fileId) === link) fileLocks.delete(fileId);
  });
  return run;
}

/**
 * Appends a request body to the file, stopping if it would exceed `maxBytes`,
 * and keeps it only if its bytes hash to `expectedSha256`.
 *
 * A chunk that is oversized, cut short, or corrupted in transit is truncated
 * back off, so the file on disk only ever holds whole verified chunks and the
 * client can retry from the offset. Returns the file's size read from disk.
 *
 * Call this inside `withFileLock(fileId, ...)`.
 */
export async function appendChunk(
  fileId: string,
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  expectedSha256: string
): Promise<number> {
  const filePath = weekFilePath(fileId);
  fs.mkdirSync(weekFilesDir(), { recursive: true });
  const startSize = bytesOnDisk(fileId);

  const digest = crypto.createHash("sha256");
  let received = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _enc, callback) {
      received += chunk.length;
      if (received > maxBytes) {
        callback(new ChunkTooLargeError("Upload is larger than the file size it declared."));
      } else {
        digest.update(chunk);
        callback(null, chunk);
      }
    },
  });

  const rollBack = () => {
    try {
      fs.truncateSync(filePath, startSize);
    } catch {
      // The file may not exist if nothing was ever written.
    }
  };

  try {
    await pipeline(
      Readable.fromWeb(body as import("stream/web").ReadableStream<Uint8Array>),
      limit,
      fs.createWriteStream(filePath, { flags: "a" })
    );
  } catch (err) {
    rollBack();
    throw err;
  }

  if (digest.digest("hex") !== expectedSha256.toLowerCase()) {
    rollBack();
    throw new ChunkHashMismatchError("The chunk did not match the digest sent with it.");
  }

  // The client is about to be told these bytes are stored, and will not send
  // them again. Get them out of the page cache first.
  const fd = fs.openSync(filePath, "r+");
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  // Read back rather than returning startSize + received: this is what the
  // next chunk's offset is checked against and what decides completion, so it
  // has to be the file itself rather than a count of what we meant to write.
  return bytesOnDisk(fileId);
}

/**
 * Hashes a finished file and records it, so a downloader can check what they
 * got (`shasum -a 256`) against what the server holds.
 *
 * Reading a whole movie back takes minutes, far longer than Cloudflare leaves
 * a request open, so this runs after the last chunk has been acknowledged
 * instead of holding that response. A file whose hash never lands (the
 * container stopped, the week closed) simply has none; it is not an error.
 */
export async function storeContentHash(fileId: string): Promise<void> {
  try {
    const digest = crypto.createHash("sha256");
    for await (const chunk of fs.createReadStream(weekFilePath(fileId))) {
      digest.update(chunk as Buffer);
    }
    // updateMany: the row is gone if the week closed meanwhile, and a file
    // that is no longer there is not something to report.
    await db.weekFile.updateMany({
      where: { id: fileId },
      data: { contentHash: digest.digest("hex") },
    });
  } catch (err) {
    console.error("Failed to hash a finished upload:", err);
  }
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
