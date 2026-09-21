-- AlterTable
ALTER TABLE "Pairing" ADD COLUMN     "tableNumber" INTEGER NOT NULL DEFAULT 1;

-- Number the tables that already exist, keeping the order they were created
-- in (which is the lineup order they were generated from).
UPDATE "Pairing" p
SET "tableNumber" = ordered.position
FROM (
  SELECT id, row_number() OVER (PARTITION BY "roundId" ORDER BY id) AS position
  FROM "Pairing"
) AS ordered
WHERE p.id = ordered.id;
