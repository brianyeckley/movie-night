import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { fetchMovieMetadata } from "../src/lib/imdb";
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

// Instantiate the Prisma adapter pointing to dev.db in root
const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function backfill() {
  console.log("Starting movie metadata backfill...");

  // Find all movies with an IMDb URL to update/refresh metadata
  const movies = await prisma.movie.findMany({
    where: {
      imdbUrl: { not: null }
    }
  });

  console.log(`Found ${movies.length} movies to update.`);

  for (const movie of movies) {
    if (!movie.imdbUrl) continue;
    console.log(`Fetching metadata for "${movie.title}" (${movie.imdbUrl})...`);
    try {
      const meta = await fetchMovieMetadata(movie.imdbUrl);
      if (meta) {
        await prisma.movie.update({
          where: { id: movie.id },
          data: {
            year: meta.year || null,
            director: meta.director || null,
            stars: meta.stars || null,
            runtime: meta.runtime || null,
            plot: meta.plot || null,
            posterUrl: meta.posterUrl || null,
            imdbRating: meta.imdbRating || null,
          }
        });
        console.log(`  ✓ Updated "${movie.title}" with: Year: ${meta.year || 'N/A'}, Dir: ${meta.director || 'N/A'}, Stars: ${meta.stars || 'N/A'}, Runtime: ${meta.runtime || 'N/A'}`);
      } else {
        console.log(`  ✗ No metadata found for "${movie.title}"`);
      }
    } catch (e) {
      console.error(`  Error processing "${movie.title}":`, e);
    }
    // Add a tiny delay to avoid spamming the APIs
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("Backfill completed!");
}

backfill()
  .catch(e => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
