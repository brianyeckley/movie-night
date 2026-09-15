-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing themed categories into Theme (excluding in-person placeholder)
INSERT INTO "Theme" ("id", "name", "deletedAt", "createdAt")
SELECT "id", "name", "deletedAt", "createdAt"
FROM "Category"
WHERE "isThemed" = 1 AND "name" != 'In Person Physical Media';

-- Delete any movies assigned directly to themed categories (per user request)
DELETE FROM "Movie"
WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "isThemed" = 1);

-- CreateTable
CREATE TABLE "_MovieToTheme" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MovieToTheme_A_fkey" FOREIGN KEY ("A") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MovieToTheme_B_fkey" FOREIGN KEY ("B") REFERENCES "Theme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Copy only non-themed categories into new_Category
INSERT INTO "new_Category" ("createdAt", "deletedAt", "id", "name", "parentId")
SELECT "createdAt", "deletedAt", "id", "name", "parentId"
FROM "Category"
WHERE "isThemed" = 0 OR "isThemed" IS NULL;

DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

CREATE TABLE "new_MovieNightWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekNumber" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'CATEGORY_VOTING',
    "themeId" TEXT,
    "selectedCategoryId" TEXT,
    "selectedSubcategoryId" TEXT,
    "selectedThemeId" TEXT,
    "winningMovieId" TEXT,
    "isRandomlyChosen" BOOLEAN NOT NULL DEFAULT false,
    "isInPerson" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "MovieNightWeek_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Copy MovieNightWeek rows, linking themeId to the migrated Theme id
INSERT INTO "new_MovieNightWeek" (
    "closedAt",
    "createdAt",
    "id",
    "isInPerson",
    "isRandomlyChosen",
    "selectedCategoryId",
    "selectedSubcategoryId",
    "selectedThemeId",
    "status",
    "weekNumber",
    "winningMovieId",
    "themeId"
)
SELECT
    "closedAt",
    "createdAt",
    "id",
    "isInPerson",
    "isRandomlyChosen",
    "selectedCategoryId",
    "selectedSubcategoryId",
    NULL,
    "status",
    "weekNumber",
    "winningMovieId",
    (CASE WHEN "themeCategoryId" IN (SELECT "id" FROM "Theme") THEN "themeCategoryId" ELSE NULL END)
FROM "MovieNightWeek";

DROP TABLE "MovieNightWeek";
ALTER TABLE "new_MovieNightWeek" RENAME TO "MovieNightWeek";
CREATE UNIQUE INDEX "MovieNightWeek_weekNumber_key" ON "MovieNightWeek"("weekNumber");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Theme_name_key" ON "Theme"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_MovieToTheme_AB_unique" ON "_MovieToTheme"("A", "B");

-- CreateIndex
CREATE INDEX "_MovieToTheme_B_index" ON "_MovieToTheme"("B");
