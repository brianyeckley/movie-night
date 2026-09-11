import { NextResponse } from "next/server";
import { readBgImage } from "@/lib/bg-storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (filename.includes("/") || filename.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const image = readBgImage(filename);
  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/webp",
      // Filenames are fresh UUIDs that are never reused, so this is safe to cache hard.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
