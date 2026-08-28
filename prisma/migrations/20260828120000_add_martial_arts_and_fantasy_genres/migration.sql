-- Step 1: Ensure "Martial Arts" genre exists in Genre table
INSERT INTO "Genre" ("id", "name", "createdAt")
SELECT 'genre-martial-arts-uuid', 'Martial Arts', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Genre" WHERE "name" = 'Martial Arts');

-- Step 2: Ensure "Fantasy" genre exists in Genre table
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

-- Step 4: Move all movies currently in the "Martial Arts" subcategory to the parent category (or fallback to 'Other')
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
