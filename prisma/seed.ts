import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

// Instantiate the Prisma adapter with the database configuration
const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = dbUrl.startsWith("file:") ? dbUrl.substring(5) : dbUrl;

const adapter = new PrismaBetterSqlite3({
  url: dbPath,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Load user credentials from environment or fallbacks
  const adminUsername = (process.env.ADMIN_USERNAME || "Brian").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const stewPassword = process.env.STEW_PASSWORD || "stew";
  const nickPassword = process.env.NICK_PASSWORD || "nick";

  // Hash passwords
  const adminHash = bcrypt.hashSync(adminPassword, 10);
  const stewHash = bcrypt.hashSync(stewPassword, 10);
  const nickHash = bcrypt.hashSync(nickPassword, 10);

  // 1. Seed Users
  const brian = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      passwordHash: adminHash,
      role: "ADMIN",
      isApproved: true,
    },
    create: {
      username: adminUsername,
      name: process.env.ADMIN_USERNAME || "Brian",
      passwordHash: adminHash,
      role: "ADMIN",
      isApproved: true,
    },
  });

  const stew = await prisma.user.upsert({
    where: { username: "stew" },
    update: {
      passwordHash: stewHash,
      isApproved: true,
    },
    create: {
      username: "stew",
      name: "Stew",
      passwordHash: stewHash,
      role: "USER",
      isApproved: true,
    },
  });

  const nick = await prisma.user.upsert({
    where: { username: "nick" },
    update: {
      passwordHash: nickHash,
      isApproved: true,
    },
    create: {
      username: "nick",
      name: "Nick",
      passwordHash: nickHash,
      role: "USER",
      isApproved: true,
    },
  });

  console.log(`Seeded Users: ${brian.name} (ADMIN), Stew (USER), Nick (USER)`);

  // 2. Seed Genres
  const genresList = ["Horror", "Sci-Fi", "Action", "Comedy", "Crime", "Schlock"];
  const genres: Record<string, any> = {};

  for (const genreName of genresList) {
    const genre = await prisma.genre.upsert({
      where: { name: genreName },
      update: {},
      create: { name: genreName },
    });
    genres[genreName] = genre;
  }

  console.log(`Seeded Genres: ${genresList.join(", ")}`);

  // 3. Seed Categories
  const comedy = await prisma.category.upsert({
    where: { name: "Comedy" },
    update: {},
    create: { name: "Comedy" },
  });

  const other = await prisma.category.upsert({
    where: { name: "Other" },
    update: {},
    create: { name: "Other" },
  });

  const legacy = await prisma.category.upsert({
    where: { name: "Legacy" },
    update: {},
    create: { name: "Legacy" },
  });

  const godzilla = await prisma.category.upsert({
    where: { name: "Godzilla" },
    update: {},
    create: { name: "Godzilla", isThemed: true },
  });

  console.log("Seeded Categories: Comedy, Other, Legacy, Godzilla");

  // 4. Seed Subcategories
  const vanDamme = await prisma.category.upsert({
    where: { name: "Jean-Claude Van Damme" },
    update: {},
    create: {
      name: "Jean-Claude Van Damme",
      parentId: other.id,
    },
  });

  console.log("Seeded Subcategory: Jean-Claude Van Damme");

  // Helper to create movies with genres
  const createMovie = async (
    title: string,
    imdbUrl: string,
    categoryId: string,
    genreNames: string[],
    physical4K: boolean = false,
    physicalBluRay: boolean = false,
    physicalDvd: boolean = false
  ) => {
    return prisma.movie.create({
      data: {
        title,
        imdbUrl,
        categoryId,
        physical4K,
        physicalBluRay,
        physicalDvd,
        genres: {
          connect: genreNames.map((name) => ({ id: genres[name].id })),
        },
      },
    });
  };

  // 5. Seed Movies
  // Comedy Movies
  await createMovie("Superbad", "https://www.imdb.com/title/t0829482/", comedy.id, ["Comedy"]);
  await createMovie("The Hangover", "https://www.imdb.com/title/t1119646/", comedy.id, ["Comedy"]);
  await createMovie("Anchorman", "https://www.imdb.com/title/t0357413/", comedy.id, ["Comedy"]);

  // Legacy Movies
  await createMovie("Alien", "https://www.imdb.com/title/t0078748/", legacy.id, ["Sci-Fi", "Horror"]);
  await createMovie("The Thing", "https://www.imdb.com/title/t0084787/", legacy.id, ["Horror", "Sci-Fi"], false, true);
  await createMovie("Die Hard", "https://www.imdb.com/title/t0095016/", legacy.id, ["Action"]);

  // Godzilla (Theme) Movies
  await createMovie("Godzilla (1954)", "https://www.imdb.com/title/t0047034/", godzilla.id, ["Sci-Fi", "Action"]);
  await createMovie("Shin Godzilla", "https://www.imdb.com/title/t4262980/", godzilla.id, ["Sci-Fi", "Action"]);
  await createMovie("Godzilla vs. Destoroyah", "https://www.imdb.com/title/t0113187/", godzilla.id, ["Sci-Fi", "Action", "Schlock"]);

  // Other Movies
  await createMovie("Pulp Fiction", "https://www.imdb.com/title/t0110912/", other.id, ["Crime"]);
  await createMovie("The Matrix", "https://www.imdb.com/title/t0133093/", other.id, ["Sci-Fi", "Action"]);

  // Subcategory Movies (Van Damme)
  await createMovie("Bloodsport", "https://www.imdb.com/title/t0094764/", vanDamme.id, ["Action", "Schlock"]);
  await createMovie("Kickboxer", "https://www.imdb.com/title/t0097659/", vanDamme.id, ["Action"]);
  await createMovie("Hard Target", "https://www.imdb.com/title/t0107076/", vanDamme.id, ["Action"]);

  console.log("Seeded Movies successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
