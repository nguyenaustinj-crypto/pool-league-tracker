-- Repair for the 2026-09-19 migration `20260919002245_roster_links_and_score_cards`,
-- which failed part-way against the production database ("column \"userId\" of
-- relation \"Player\" already exists") and left it stuck: Prisma refuses to
-- apply anything after a failed migration.
--
-- That migration is marked as applied by scripts/repair-failed-migration.mjs,
-- and this one puts in whatever it didn't manage to create. Every step is
-- skipped if the object is already there, so it's safe whatever state a
-- database is in -- including databases where the original migration worked.

-- CreateEnum (no IF NOT EXISTS for types)
DO $$
BEGIN
  CREATE TYPE "PairingStatus" AS ENUM ('EMPTY', 'ENTERED', 'CONFIRMED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "lockedById" TEXT;

-- AlterTable
ALTER TABLE "Pairing" ADD COLUMN IF NOT EXISTS "homeGame1Ero" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Pairing" ADD COLUMN IF NOT EXISTS "homeGame2Ero" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Pairing" ADD COLUMN IF NOT EXISTS "awayGame1Ero" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Pairing" ADD COLUMN IF NOT EXISTS "awayGame2Ero" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Pairing" ADD COLUMN IF NOT EXISTS "status" "PairingStatus" NOT NULL DEFAULT 'EMPTY';
ALTER TABLE "Pairing" ADD COLUMN IF NOT EXISTS "enteredById" TEXT;
ALTER TABLE "Pairing" ADD COLUMN IF NOT EXISTS "confirmedById" TEXT;
ALTER TABLE "Pairing" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScoreEdit" (
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
CREATE INDEX IF NOT EXISTS "ScoreEdit_pairingId_idx" ON "ScoreEdit"("pairingId");
CREATE INDEX IF NOT EXISTS "Player_userId_idx" ON "Player"("userId");

-- AddForeignKey (no IF NOT EXISTS for constraints)
DO $$
BEGIN
  ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "ScoreEdit" ADD CONSTRAINT "ScoreEdit_pairingId_fkey"
    FOREIGN KEY ("pairingId") REFERENCES "Pairing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Scores entered before score cards had a status were entered by an editor
-- (a manager or the passcode), so treat them as already confirmed. Only
-- touches cards still sitting at the default.
UPDATE "Pairing"
SET "status" = 'CONFIRMED'
WHERE "status" = 'EMPTY'
  AND ("homeGame1" <> 0 OR "homeGame2" <> 0 OR "awayGame1" <> 0 OR "awayGame2" <> 0);
