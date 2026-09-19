-- CreateEnum
CREATE TYPE "PairingStatus" AS ENUM ('EMPTY', 'ENTERED', 'CONFIRMED');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedById" TEXT;

-- AlterTable
ALTER TABLE "Pairing" ADD COLUMN     "awayGame1Ero" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "awayGame2Ero" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "confirmedById" TEXT,
ADD COLUMN     "enteredById" TEXT,
ADD COLUMN     "homeGame1Ero" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "homeGame2Ero" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "PairingStatus" NOT NULL DEFAULT 'EMPTY',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "ScoreEdit" (
    "id" TEXT NOT NULL,
    "pairingId" TEXT NOT NULL,
    "userId" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreEdit_pairingId_idx" ON "ScoreEdit"("pairingId");

-- CreateIndex
CREATE INDEX "Player_userId_idx" ON "Player"("userId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEdit" ADD CONSTRAINT "ScoreEdit_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "Pairing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Scores entered before score cards had a status were entered by an editor
-- (a manager or the passcode), so treat them as already confirmed.
UPDATE "Pairing"
SET "status" = 'CONFIRMED'
WHERE "homeGame1" <> 0 OR "homeGame2" <> 0 OR "awayGame1" <> 0 OR "awayGame2" <> 0;
