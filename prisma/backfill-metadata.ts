import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { fetchMovieMetadata } from "../src/lib/imdb";

// Instantiate the Prisma adapter pointing to dev.db in root
const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function backfill() {
  console.log("Starting movie metadata backfill...");

  // Find all movies with an IMDb URL that lack metadata
  const movies = await prisma.movie.findMany({
    where: {
      imdbUrl: { not: null },
      OR: [
        { year: null },
        { director: null },
        { stars: null },
        { runtime: null }
      ]
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
