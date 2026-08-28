import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";

describe("Martial Arts and Fantasy migration logic", () => {
  it("correctly migrates Martial Arts category movies to Other and assigns Martial Arts genre tag", () => {
    // Create an in-memory SQLite database replicating the schema and migration
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE "Category" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "parentId" TEXT
      );
      CREATE TABLE "Genre" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE "Movie" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL
      );
      CREATE TABLE "_GenreToMovie" (
        "A" TEXT NOT NULL,
        "B" TEXT NOT NULL,
        UNIQUE("A", "B")
      );
      CREATE TABLE "MovieNightWeek" (
        "id" TEXT PRIMARY KEY,
        "selectedSubcategoryId" TEXT
      );

      -- Initial seed data
      INSERT INTO "Category" ("id", "name", "parentId") VALUES ('cat-other', 'Other', NULL);
      INSERT INTO "Category" ("id", "name", "parentId") VALUES ('cat-ma', 'Martial Arts', 'cat-other');

      INSERT INTO "Genre" ("id", "name") VALUES ('genre-action', 'Action');

      INSERT INTO "Movie" ("id", "title", "categoryId") VALUES ('movie-ip-man', 'Ip Man', 'cat-ma');
      INSERT INTO "Movie" ("id", "title", "categoryId") VALUES ('movie-ong-bak', 'Ong-Bak', 'cat-ma');

      INSERT INTO "_GenreToMovie" ("A", "B") VALUES ('genre-action', 'movie-ip-man');

      INSERT INTO "MovieNightWeek" ("id", "selectedSubcategoryId") VALUES ('week-1', 'cat-ma');
    `);

    // Execute the migration steps
    db.exec(`
      -- Step 1: Ensure "Martial Arts" genre exists
      INSERT INTO "Genre" ("id", "name", "createdAt")
      SELECT 'genre-martial-arts-uuid', 'Martial Arts', CURRENT_TIMESTAMP
      WHERE NOT EXISTS (SELECT 1 FROM "Genre" WHERE "name" = 'Martial Arts');

      -- Step 2: Ensure "Fantasy" genre exists
      INSERT INTO "Genre" ("id", "name", "createdAt")
      SELECT 'genre-fantasy-uuid', 'Fantasy', CURRENT_TIMESTAMP
      WHERE NOT EXISTS (SELECT 1 FROM "Genre" WHERE "name" = 'Fantasy');

      -- Step 3: Connect all movies in the "Martial Arts" category to the "Martial Arts" genre
      INSERT OR IGNORE INTO "_GenreToMovie" ("A", "B")
      SELECT 
          g."id" AS "A",
          m."id" AS "B"
      FROM "Movie" m
      JOIN "Category" c ON m."categoryId" = c."id"
      JOIN "Genre" g ON g."name" = 'Martial Arts'
      WHERE c."name" = 'Martial Arts';

      -- Step 4: Move all movies in Martial Arts subcategory to parent category (or 'Other')
      UPDATE "Movie"
      SET "categoryId" = (
          SELECT COALESCE(
              c."parentId",
              (SELECT "id" FROM "Category" WHERE "name" = 'Other' LIMIT 1)
          )
          FROM "Category" c
          WHERE c."id" = "Movie"."categoryId"
      )
      WHERE "categoryId" IN (
          SELECT "id" FROM "Category" WHERE "name" = 'Martial Arts'
      );

      -- Step 5: Nullify any selectedSubcategoryId references to Martial Arts in MovieNightWeek
      UPDATE "MovieNightWeek"
      SET "selectedSubcategoryId" = NULL
      WHERE "selectedSubcategoryId" IN (
          SELECT "id" FROM "Category" WHERE "name" = 'Martial Arts'
      );

      -- Step 6: Delete the "Martial Arts" category
      DELETE FROM "Category" WHERE "name" = 'Martial Arts';
    `);

    // Assertions
    const genres = db.prepare("SELECT name FROM Genre ORDER BY name ASC").all();
    expect(genres.map((g: any) => g.name)).toEqual(["Action", "Fantasy", "Martial Arts"]);

    const categories = db.prepare("SELECT name FROM Category").all();
    expect(categories.map((c: any) => c.name)).toEqual(["Other"]);

    const movies = db.prepare("SELECT id, title, categoryId FROM Movie").all() as any[];
    expect(movies).toHaveLength(2);
    expect(movies[0].categoryId).toBe("cat-other");
    expect(movies[1].categoryId).toBe("cat-other");

    const movieGenres = db.prepare(`
      SELECT m.title, g.name AS genreName 
      FROM "_GenreToMovie" gm 
      JOIN "Movie" m ON gm.B = m.id 
      JOIN "Genre" g ON gm.A = g.id
      ORDER BY m.title, g.name
    `).all() as any[];

    expect(movieGenres).toEqual([
      { title: "Ip Man", genreName: "Action" },
      { title: "Ip Man", genreName: "Martial Arts" },
      { title: "Ong-Bak", genreName: "Martial Arts" },
    ]);

    const week = db.prepare("SELECT selectedSubcategoryId FROM MovieNightWeek WHERE id = 'week-1'").get() as any;
    expect(week.selectedSubcategoryId).toBeNull();
  });
});
