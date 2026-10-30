import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import {
  MAX_CHUNK_BYTES,
  ChunkHashMismatchError,
  ChunkTooLargeError,
  appendChunk,
  bytesOnDisk,
  deleteWeekFileFromDisk,
  storeContentHash,
  withFileLock,
} from "@/lib/week-files";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ weekId: string }> };

function error(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Appends one chunk of an upload started by POST ../.
 *
 * The client says which byte offset the chunk starts at and sends a SHA-256 of
 * the bytes it is about to send. When the offset does not match what is on
 * disk (a retry after a lost response, say), the reply carries the real
 * `received` count so the client can carry on from there; when the digest does
 * not match, the chunk is thrown away and the client sends it again.
 *
 * Everything from reading the file's length to recording the result happens
 * under `withFileLock`, so a retry that arrives while the request it is
 * replacing is still writing waits its turn instead of interleaving with it.
 */
export async function PUT(request: Request, { params }: Params) {
  const user = await getActiveUser();
  if (!user) return error("You must be signed in.", 401);

  const { weekId } = await params;
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId");
  const offset = Number(url.searchParams.get("offset"));
  const expectedHash = request.headers.get("x-chunk-sha256")?.toLowerCase();
  const body = request.body;

  if (!uploadId) return error("An upload id is required.", 400);
  if (!Number.isSafeInteger(offset) || offset < 0) return error("A byte offset is required.", 400);
  if (!expectedHash || !/^[0-9a-f]{64}$/.test(expectedHash)) {
    return error("A SHA-256 digest of the chunk is required.", 400);
  }
  if (!body) return error("Chunk is empty.", 400);

  return withFileLock(uploadId, async () => {
    // Read inside the lock: the slot can be taken over or cancelled while a
    // request is queued behind another one.
    const file = await db.weekFile.findUnique({ where: { weekId } });
    if (!file || file.id !== uploadId) {
      return error("This upload was cancelled or replaced.", 410);
    }
    if (file.uploadedById !== user.id) return error("This upload belongs to someone else.", 403);
    if (file.completedAt) return error("This upload is already finished.", 409);

    const size = Number(file.size);
    const received = bytesOnDisk(file.id);
    if (offset !== received) {
      return error("Offset does not match the bytes received.", 409, { received });
    }

    let newSize: number;
    try {
      newSize = await appendChunk(file.id, body, Math.min(MAX_CHUNK_BYTES, size - received), expectedHash);
    } catch (err) {
      if (err instanceof ChunkTooLargeError) return error(err.message, 413);
      if (err instanceof ChunkHashMismatchError) {
        // Corrupted in transit. The bytes are already off the file again, so
        // the client can send the same chunk straight back.
        return error("That chunk arrived corrupted. Sending it again.", 422, {
          received: bytesOnDisk(file.id),
        });
      }
      // Most often the browser cancelled the upload mid-chunk.
      console.error("Failed to write upload chunk:", err);
      return error("Failed to save the chunk.", 500, { received: bytesOnDisk(file.id) });
    }

    if (newSize > size) {
      // The lock and the per-chunk cap rule this out; never mark a file that
      // somehow holds more than it declared as finished.
      console.error(`Upload ${file.id} holds ${newSize} bytes but declared ${size}.`);
      return error("More bytes arrived than this file declared.", 409, { received: newSize });
    }

    // Bumps updatedAt too, which is what keeps an active upload from going stale.
    const done = newSize === size;
    try {
      await db.weekFile.update({
        where: { id: file.id },
        data: { completedAt: done ? new Date() : null },
      });
    } catch {
      // Cancelled while this chunk was being written. The delete could not
      // remove a file that was still open on every platform, so finish it here.
      deleteWeekFileFromDisk(file.id);
      return error("This upload was cancelled or replaced.", 410);
    }
    if (done) {
      revalidatePath("/");
      // Hashing a whole movie takes minutes, so it runs on its own after the
      // uploader has been told the upload finished.
      void storeContentHash(file.id);
    }

    return NextResponse.json({ received: newSize, done });
  });
}
