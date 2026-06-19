-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Movie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "imdbUrl" TEXT,
    "trailerUrl" TEXT,
    "year" INTEGER,
    "director" TEXT,
    "stars" TEXT,
    "runtime" TEXT,
    "plot" TEXT,
    "posterUrl" TEXT,
    "imdbRating" TEXT,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "physical4K" BOOLEAN NOT NULL DEFAULT false,
    "physicalBluRay" BOOLEAN NOT NULL DEFAULT false,
    "physicalDvd" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Movie_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Movie" ("categoryId", "createdAt", "director", "id", "imdbRating", "imdbUrl", "plot", "posterUrl", "runtime", "stars", "title", "trailerUrl", "watched", "year") SELECT "categoryId", "createdAt", "director", "id", "imdbRating", "imdbUrl", "plot", "posterUrl", "runtime", "stars", "title", "trailerUrl", "watched", "year" FROM "Movie";
DROP TABLE "Movie";
ALTER TABLE "new_Movie" RENAME TO "Movie";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
