-- CreateTable
CREATE TABLE "MovieBackgroundImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "movieId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "panelAlign" TEXT NOT NULL DEFAULT 'right',
    "bgPosition" TEXT NOT NULL DEFAULT 'center center',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovieBackgroundImage_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
