import fs from "fs";
import path from "path";
import crypto from "crypto";

const BG_IMAGES_DIR = path.join(process.cwd(), "data/bg-images");

export function saveBgImage(buffer: Buffer): string {
  fs.mkdirSync(BG_IMAGES_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.webp`;
  fs.writeFileSync(path.join(BG_IMAGES_DIR, filename), buffer);
  return filename;
}

export function readBgImage(filename: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(BG_IMAGES_DIR, filename));
  } catch {
    return null;
  }
}

export function deleteBgImageFile(filename: string): void {
  try {
    fs.unlinkSync(path.join(BG_IMAGES_DIR, filename));
  } catch {
    // Already gone, or never existed — nothing left to clean up.
  }
}
