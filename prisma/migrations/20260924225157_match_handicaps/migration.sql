-- AlterTable
ALTER TABLE "Pairing" ADD COLUMN     "awayHandicap" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "homeHandicap" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Existing matches keep the numbers they were scored with: copy each
-- player's current roster handicap into their cards, once.
UPDATE "Pairing" p
SET "homeHandicap" = hp."rating",
    "awayHandicap" = ap."rating"
FROM "Player" hp, "Player" ap
WHERE hp."id" = p."homePlayerId"
  AND ap."id" = p."awayPlayerId";
