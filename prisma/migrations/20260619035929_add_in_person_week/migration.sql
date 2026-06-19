-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MovieNightWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CATEGORY_VOTING',
    "themeCategoryId" TEXT,
    "selectedCategoryId" TEXT,
    "selectedSubcategoryId" TEXT,
    "winningMovieId" TEXT,
    "isRandomlyChosen" BOOLEAN NOT NULL DEFAULT false,
    "isInPerson" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "MovieNightWeek_themeCategoryId_fkey" FOREIGN KEY ("themeCategoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MovieNightWeek" ("closedAt", "createdAt", "id", "isRandomlyChosen", "selectedCategoryId", "selectedSubcategoryId", "status", "themeCategoryId", "weekNumber", "winningMovieId") SELECT "closedAt", "createdAt", "id", "isRandomlyChosen", "selectedCategoryId", "selectedSubcategoryId", "status", "themeCategoryId", "weekNumber", "winningMovieId" FROM "MovieNightWeek";
DROP TABLE "MovieNightWeek";
ALTER TABLE "new_MovieNightWeek" RENAME TO "MovieNightWeek";
CREATE UNIQUE INDEX "MovieNightWeek_weekNumber_key" ON "MovieNightWeek"("weekNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
