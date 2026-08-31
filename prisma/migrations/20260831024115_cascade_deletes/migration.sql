-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leagueId" TEXT NOT NULL,
    "homeLabel" TEXT,
    "awayLabel" TEXT,
    CONSTRAINT "Match_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("awayLabel", "date", "homeLabel", "id", "leagueId") SELECT "awayLabel", "date", "homeLabel", "id", "leagueId" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE TABLE "new_Pairing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "homePlayerId" TEXT NOT NULL,
    "awayPlayerId" TEXT NOT NULL,
    "homeGame1" REAL NOT NULL DEFAULT 0,
    "homeGame2" REAL NOT NULL DEFAULT 0,
    "awayGame1" REAL NOT NULL DEFAULT 0,
    "awayGame2" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Pairing_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pairing_homePlayerId_fkey" FOREIGN KEY ("homePlayerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pairing_awayPlayerId_fkey" FOREIGN KEY ("awayPlayerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Pairing" ("awayGame1", "awayGame2", "awayPlayerId", "homeGame1", "homeGame2", "homePlayerId", "id", "roundId") SELECT "awayGame1", "awayGame2", "awayPlayerId", "homeGame1", "homeGame2", "homePlayerId", "id", "roundId" FROM "Pairing";
DROP TABLE "Pairing";
ALTER TABLE "new_Pairing" RENAME TO "Pairing";
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rating" REAL NOT NULL,
    "leagueId" TEXT NOT NULL,
    CONSTRAINT "Player_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("id", "leagueId", "name", "rating") SELECT "id", "leagueId", "name", "rating" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE TABLE "new_Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    CONSTRAINT "Round_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Round" ("id", "matchId", "roundNumber") SELECT "id", "matchId", "roundNumber" FROM "Round";
DROP TABLE "Round";
ALTER TABLE "new_Round" RENAME TO "Round";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
