import fs from "fs";
import path from "path";
import { db } from "@/lib/db";

const BG_DIR = path.join(process.cwd(), "public/bg");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULT_PANEL_ALIGN: PanelAlign = "right";
const DEFAULT_BG_POSITION = "center center";

export type PanelAlign = "left" | "center" | "right";

export interface BgImageCredit {
  title: string;
  year: number;
  /** Formatted MM/DD/YYYY, or "TBD" until the movie has a watched date. */
  watched: string;
}

/** The raw shape of one entry in the legacy `credits.json`. */
interface BgImageEntry extends BgImageCredit {
  panelAlign?: PanelAlign;
  bgPosition?: string;
}

export interface BgImage {
  url: string;
  credit: BgImageCredit | null;
  panelAlign: PanelAlign;
  /** CSS `background-position` value for this image. */
  bgPosition: string;
}

/**
 * Stored `closedAt` values are always 22:00:00 UTC on the intended calendar
 * day (see the timezone fix in the simulated Past Movie Nights data), which
 * keeps the UTC and any realistic local calendar day identical -- so reading
 * the UTC components directly is deterministic regardless of server TZ.
 */
function formatWatchedDate(closedAt: Date): string {
  return `${closedAt.getUTCMonth() + 1}/${closedAt.getUTCDate()}/${closedAt.getUTCFullYear()}`;
}

function loadLegacyEntries(): Record<string, BgImageEntry> {
  const creditsPath = path.join(BG_DIR, "credits.json");
  try {
    return JSON.parse(fs.readFileSync(creditsPath, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Movies with no catalog row yet (e.g. The Man Who Fell to Earth) still fall
 * back to the static public/bg + credits.json pool used before background
 * images became real Movie data. Once every legacy entry has a matching
 * Movie, this function -- and the files/JSON it reads -- can be deleted.
 */
function listLegacyImages(): BgImage[] {
  const entries = loadLegacyEntries();
  let filenames: string[];
  try {
    filenames = fs
      .readdirSync(BG_DIR)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()));
  } catch {
    return [];
  }

  return filenames.map((filename) => {
    const entry = entries[filename];
    return {
      url: `/bg/${encodeURIComponent(filename)}`,
      credit: entry ? { title: entry.title, year: entry.year, watched: entry.watched } : null,
      panelAlign: entry?.panelAlign ?? DEFAULT_PANEL_ALIGN,
      bgPosition: entry?.bgPosition ?? DEFAULT_BG_POSITION,
    };
  });
}

/** Picks a random background image, paired with its movie's credit info. */
export async function getRandomBgImage(): Promise<BgImage | null> {
  const dbImages = await db.movieBackgroundImage.findMany({
    select: {
      filename: true,
      panelAlign: true,
      bgPosition: true,
      movie: { select: { id: true, title: true, year: true } },
    },
  });
  const legacyImages = listLegacyImages();

  const pool = dbImages.length + legacyImages.length;
  if (pool === 0) return null;

  const index = Math.floor(Math.random() * pool);
  if (index >= dbImages.length) {
    return legacyImages[index - dbImages.length];
  }

  const picked = dbImages[index];
  const week = await db.movieNightWeek.findFirst({
    where: { winningMovieId: picked.movie.id, closedAt: { not: null } },
    orderBy: { closedAt: "desc" },
    select: { closedAt: true },
  });

  return {
    url: `/media/bg/${picked.filename}`,
    credit: {
      title: picked.movie.title,
      year: picked.movie.year ?? 0,
      watched: week?.closedAt ? formatWatchedDate(week.closedAt) : "TBD",
    },
    panelAlign: picked.panelAlign as PanelAlign,
    bgPosition: picked.bgPosition,
  };
}
