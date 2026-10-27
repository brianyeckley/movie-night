import fs from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveUser } from "@/app/actions/user";
import {
  CHUNK_SIZE,
  STALE_UPLOAD_MS,
  bytesOnDisk,
  deleteWeekFileFromDisk,
  weekFilePath,
} from "@/lib/week-files";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ weekId: string }> };

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Starts an upload: reserves the week's one file slot and returns the id the
 * chunks are sent against. The bytes themselves go to ./chunk.
 */
export async function POST(request: Request, { params }: Params) {
  // /api is outside the proxy's sign-in check, so every handler checks itself.
  const user = await getActiveUser();
  if (!user) return error("You must be signed in.", 401);

  const { weekId } = await params;
  const { name, size } = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    size?: unknown;
  };
  if (typeof name !== "string" || !name.trim()) return error("File name is required.", 400);
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) {
    return error("File size is required.", 400);
  }

  const week = await db.movieNightWeek.findUnique({ where: { id: weekId } });
  if (!week || week.closedAt || !week.winningMovieId) {
    return error("Files can only be added to a winning movie that hasn't been closed out.", 409);
  }

  const existing = await db.weekFile.findUnique({
    where: { weekId },
    include: { uploadedBy: true },
  });
  if (existing) {
    if (existing.completedAt) return error("This movie already has a file.", 409);

    // An unfinished upload: let its own uploader restart it, and let anyone
    // take over once it has gone quiet, so a closed tab can't lock the slot.
    const isStale = Date.now() - existing.updatedAt.getTime() > STALE_UPLOAD_MS;
    if (existing.uploadedById !== user.id && !isStale) {
      const who = existing.uploadedBy?.name ?? "Someone";
      return error(`${who} is uploading a file for this movie right now.`, 409);
    }
    await db.weekFile.delete({ where: { id: existing.id } });
    deleteWeekFileFromDisk(existing.id);
  }

  const file = await db.weekFile.create({
    data: {
      weekId,
      uploadedById: user.id,
      originalName: name.trim().slice(0, 255),
      size: BigInt(size),
    },
  });

  return NextResponse.json({ uploadId: file.id, chunkSize: CHUNK_SIZE });
}

/** Downloads the week's file, with Range support so big downloads can resume. */
export async function GET(request: Request, { params }: Params) {
  const user = await getActiveUser();
  if (!user) return error("You must be signed in.", 401);

  const { weekId } = await params;
  const file = await db.weekFile.findUnique({ where: { weekId } });
  if (!file || !file.completedAt) return error("Not found", 404);

  const total = bytesOnDisk(file.id);
  if (total === 0) return error("Not found", 404);

  // A finished row over a short file: bytes the uploader was told had arrived
  // never reached the disk, most likely a restart mid-upload. Serving this
  // hands over a movie that stops part way through and looks like a complete
  // download, so refuse it and say what to do instead.
  const declared = Number(file.size);
  if (total !== declared) {
    console.error(`WeekFile ${file.id} holds ${total} bytes but its row declares ${declared}.`);
    return error(
      "This file is incomplete on the server, so downloading it would give you a broken movie. It needs uploading again.",
      409
    );
  }

  // Strip characters that would break the quoted ASCII fallback; filename*
  // carries the real name for every current browser.
  const asciiName = file.originalName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  };
  // Lets someone check a finished download against what the server holds.
  if (file.contentHash) headers["X-Content-SHA256"] = file.contentHash;

  let start = 0;
  let end = total - 1;
  let status = 200;

  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), total - 1);
    } else {
      // "bytes=-N" means the last N bytes.
      start = Math.max(0, total - Number(range[2]));
    }
    if (start > end || start >= total) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
  }
  headers["Content-Length"] = String(end - start + 1);

  const stream = fs.createReadStream(weekFilePath(file.id), { start, end });
  return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status,
    headers,
  });
}
