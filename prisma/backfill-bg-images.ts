import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { saveBgImage } from "../src/lib/bg-storage";
import fs from "fs";
import path from "path";

// Load .env file manually into process.env for standalone script execution
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
}

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = dbUrl.startsWith("file:") ? dbUrl.substring(5) : dbUrl;

const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

const BG_DIR = path.join(process.cwd(), "public/bg");

interface CreditsEntry {
  title: string;
  year: number;
  watched: string;
  panelAlign?: string;
  bgPosition?: string;
}

/**
 * One-time move of public/bg/*.webp + credits.json into real MovieBackgroundImage
 * rows tied to a catalog Movie, matched by exact title. Movies with no catalog
 * row yet (The Man Who Fell to Earth, as of writing) are left untouched --
 * their files and credits.json entries keep working through the legacy path
 * in src/lib/bg-images.ts until they get a real Movie row.
 *
 * Safe to run more than once: a movie that already has any background image
 * is assumed fully migrated and skipped.
 */
async function backfill() {
  console.log("Starting background image backfill...");

  const creditsPath = path.join(BG_DIR, "credits.json");
  const entries: Record<string, CreditsEntry> = JSON.parse(fs.readFileSync(creditsPath, "utf-8"));

  const byTitle = new Map<string, [string, CreditsEntry][]>();
  for (const pair of Object.entries(entries)) {
    const title = pair[1].title;
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title)!.push(pair);
  }

  let migratedMovies = 0;
  let migratedImages = 0;

  for (const [title, files] of byTitle) {
    const movie = await prisma.movie.findFirst({ where: { title } });
    if (!movie) {
      console.log(`  - No catalog movie for "${title}" (${files.length} image(s)), leaving on the legacy path.`);
      continue;
    }

    const existingCount = await prisma.movieBackgroundImage.count({ where: { movieId: movie.id } });
    if (existingCount > 0) {
      console.log(`  - "${title}" already has ${existingCount} background image(s), skipping.`);
      continue;
    }

    for (const [filename, entry] of files) {
      const sourcePath = path.join(BG_DIR, filename);
      if (!fs.existsSync(sourcePath)) {
        console.log(`  - Missing file for "${title}": ${filename}`);
        continue;
      }
      const buffer = fs.readFileSync(sourcePath);
      const newFilename = saveBgImage(buffer);
      await prisma.movieBackgroundImage.create({
        data: {
          movieId: movie.id,
          filename: newFilename,
          panelAlign: entry.panelAlign,
          bgPosition: entry.bgPosition,
        },
      });
      migratedImages++;
    }
    console.log(`  ✓ Migrated ${files.length} image(s) for "${title}"`);
    migratedMovies++;
  }

  console.log(`Backfill completed: ${migratedImages} image(s) across ${migratedMovies} movie(s).`);
}

backfill()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
