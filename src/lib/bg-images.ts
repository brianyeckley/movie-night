import fs from "fs";
import path from "path";

const BG_DIR = path.join(process.cwd(), "public/bg");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULT_PANEL_ALIGN: PanelAlign = "right";
const DEFAULT_BG_POSITION = "center center";

export type PanelAlign = "left" | "center" | "right";

export interface BgImageCredit {
  title: string;
  year: number;
  /** Formatted MM/DD/YYYY, or "TBD" until filled in. */
  watched: string;
}

/** The raw shape of one entry in `credits.json`. */
interface BgImageEntry extends BgImageCredit {
  /** Which side of the page the login panel sits on over this image. */
  panelAlign?: PanelAlign;
  /** CSS `background-position` value, e.g. "center center" or "top left". */
  bgPosition?: string;
}

export interface BgImage {
  /** Public URL, e.g. "/bg/some%20file.jpg". */
  url: string;
  credit: BgImageCredit | null;
  panelAlign: PanelAlign;
  /** CSS `background-position` value for this image. */
  bgPosition: string;
}

function loadEntries(): Record<string, BgImageEntry> {
  const creditsPath = path.join(BG_DIR, "credits.json");
  try {
    return JSON.parse(fs.readFileSync(creditsPath, "utf-8"));
  } catch {
    return {};
  }
}

function listBgFilenames(): string[] {
  try {
    return fs
      .readdirSync(BG_DIR)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()));
  } catch {
    return [];
  }
}

/** Picks a random image from `public/bg`, paired with its credit info if any. */
export function getRandomBgImage(): BgImage | null {
  const filenames = listBgFilenames();
  if (filenames.length === 0) return null;

  const entries = loadEntries();
  const filename = filenames[Math.floor(Math.random() * filenames.length)];
  const entry = entries[filename];

  return {
    url: `/bg/${encodeURIComponent(filename)}`,
    credit: entry ? { title: entry.title, year: entry.year, watched: entry.watched } : null,
    panelAlign: entry?.panelAlign ?? DEFAULT_PANEL_ALIGN,
    bgPosition: entry?.bgPosition ?? DEFAULT_BG_POSITION,
  };
}
