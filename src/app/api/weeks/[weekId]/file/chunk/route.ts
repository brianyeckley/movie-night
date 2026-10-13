import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import {
  CHUNK_SIZE,
  ChunkTooLargeError,
  appendChunk,
  bytesOnDisk,
  deleteWeekFileFromDisk,
} from "@/lib/week-files";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ weekId: string }> };

function error(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Appends one chunk of an upload started by POST ../.
 *
 * The client says which byte offset the chunk starts at. When that does not
 * match what is on disk (a retry after a lost response, say), the reply
 * carries the real `received` count so the client can carry on from there.
 */
export async function PUT(request: Request, { params }: Params) {
  const user = await getActiveUser();
  if (!user) return error("You must be signed in.", 401);

  const { weekId } = await params;
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId");
  const offset = Number(url.searchParams.get("offset"));

  const file = await db.weekFile.findUnique({ where: { weekId } });
  if (!file || file.id !== uploadId) {
    return error("This upload was cancelled or replaced.", 410);
  }
  if (file.uploadedById !== user.id) return error("This upload belongs to someone else.", 403);
  if (file.completedAt) return error("This upload is already finished.", 409);
  if (!request.body) return error("Chunk is empty.", 400);

  const size = Number(file.size);
  const received = bytesOnDisk(file.id);
  if (offset !== received) {
    return error("Offset does not match the bytes received.", 409, { received });
  }

  let newSize: number;
  try {
    newSize = await appendChunk(file.id, request.body, Math.min(CHUNK_SIZE, size - received));
  } catch (err) {
    if (err instanceof ChunkTooLargeError) return error(err.message, 413);
    // Most often the browser cancelled the upload mid-chunk.
    console.error("Failed to write upload chunk:", err);
    return error("Failed to save the chunk.", 500, { received: bytesOnDisk(file.id) });
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
  if (done) revalidatePath("/");

  return NextResponse.json({ received: newSize, done });
}
