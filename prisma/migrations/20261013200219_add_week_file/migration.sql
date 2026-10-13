-- CreateTable
CREATE TABLE "WeekFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "originalName" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeekFile_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "MovieNightWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeekFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WeekFile_weekId_key" ON "WeekFile"("weekId");
