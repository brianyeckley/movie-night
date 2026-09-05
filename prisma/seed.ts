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

/**
 * Create a user if they do not exist, and otherwise leave them completely alone.
 *
 * Seeding must never touch an account that already exists. This used to upsert
 * with `update: { passwordHash, role, isApproved }`, so re-running the seed —
 * a command the docs list as routine — reset everyone's password, re-promoted
 * the admin and re-approved all three, silently undoing anything done through
 * the admin screen.
 *
 * The password is only read when a user actually has to be created, and there
 * is no fallback: a missing variable stops the seed rather than quietly
 * creating an account with a guessable password on a publicly reachable app.
 */
async function ensureUser(opts: {
  username: string;
  name: string;
  role: "ADMIN" | "USER";
  passwordEnvVar: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { username: opts.username },
  });

  if (existing) {
    console.log(`  - ${opts.username}: already exists, left untouched`);
    return existing;
  }

  const password = process.env[opts.passwordEnvVar];
  if (!password) {
    throw new Error(
      `Cannot create user "${opts.username}": ${opts.passwordEnvVar} is not set. ` +
        `Set it in your .env (see .env.example) and run the seed again.`
    );
  }

  const created = await prisma.user.create({
    data: {
      username: opts.username,
      name: opts.name,
      passwordHash: bcrypt.hashSync(password, 10),
      role: opts.role,
      isApproved: true,
    },
  });
  console.log(`  - ${opts.username}: created (${opts.role})`);
  return created;
}

async function main() {
  console.log("Seeding database...");

  const adminUsername = (process.env.ADMIN_USERNAME || "Brian").toLowerCase().trim();

  // 1. Seed Users - existing accounts are never modified.
  console.log("Users:");
  const brian = await ensureUser({
    username: adminUsername,
    name: process.env.ADMIN_USERNAME || "Brian",
    role: "ADMIN",
    passwordEnvVar: "ADMIN_PASSWORD",
  });
  await ensureUser({
    username: "stew",
    name: "Stew",
    role: "USER",
    passwordEnvVar: "STEW_PASSWORD",
  });
  await ensureUser({
    username: "nick",
    name: "Nick",
    role: "USER",
    passwordEnvVar: "NICK_PASSWORD",
  });

  // Report the roles actually in the database, not the ones seeding would have
  // set - an existing account may since have been demoted on purpose.
  console.log(`Seeded Users: ${brian.name} (${brian.role})`);

  // 2. Seed Genres
  const genresList = ["Horror", "Sci-Fi", "Action", "Comedy", "Crime", "Schlock", "Martial Arts", "Fantasy"];
  const genres: Record<string, { id: string; name: string }> = {};

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
