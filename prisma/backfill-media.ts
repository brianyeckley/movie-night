import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";
import path from "path";

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = dbUrl.startsWith("file:") ? dbUrl.substring(5) : dbUrl;

const adapter = new PrismaBetterSqlite3({
  url: dbPath,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting physical media backfill...");

  // 1. Read the extracted movies JSON file
  const jsonPath = path.join(__dirname, "extracted-movies.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: Extracted movies JSON file not found at: ${jsonPath}`);
    process.exit(1);
  }

  const fileData = fs.readFileSync(jsonPath, "utf8");
  const extractedMovies = JSON.parse(fileData);
  console.log(`Loaded ${extractedMovies.length} movies from JSON.`);

  // 2. Fetch all existing movies from the database
  const dbMovies = await prisma.movie.findMany();
  console.log(`Fetched ${dbMovies.length} movies from the database.`);

  // 3. Create a lookup map of normalized movie titles in the DB
  const dbMovieMap = new Map<string, any>();
  dbMovies.forEach((movie) => {
    dbMovieMap.set(movie.title.toLowerCase().trim(), movie);
  });

  // 4. Match and update movies
  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of extractedMovies) {
    const key = item.title.toLowerCase().trim();
    const matchedMovie = dbMovieMap.get(key);

    if (matchedMovie) {
      const updateData: any = {};
      if (item.type === "4K") {
        updateData.physical4K = true;
      } else if (item.type === "blu-ray") {
        updateData.physicalBluRay = true;
      } else if (item.type === "dvd") {
        updateData.physicalDvd = true;
      }

      await prisma.movie.update({
        where: { id: matchedMovie.id },
        data: updateData,
      });

      console.log(`  [UPDATED] "${matchedMovie.title}" -> ${item.type}`);
      updatedCount++;
    } else {
      console.log(`  [SKIPPED] "${item.title}" (not found in database)`);
      skippedCount++;
    }
  }

  console.log("\nBackfill Summary:");
  console.log(`  Total processed: ${extractedMovies.length}`);
  console.log(`  Successfully updated: ${updatedCount}`);
  console.log(`  Skipped (not found): ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
