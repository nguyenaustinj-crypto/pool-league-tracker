/*
  Warnings:

  - Added the required column `leagueId` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "venueId" TEXT,
    CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Team_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("id", "name", "venueId") SELECT "id", "name", "venueId" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
