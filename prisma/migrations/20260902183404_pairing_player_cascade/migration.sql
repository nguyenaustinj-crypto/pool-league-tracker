-- DropForeignKey
ALTER TABLE "Pairing" DROP CONSTRAINT "Pairing_awayPlayerId_fkey";

-- DropForeignKey
ALTER TABLE "Pairing" DROP CONSTRAINT "Pairing_homePlayerId_fkey";

-- AddForeignKey
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_homePlayerId_fkey" FOREIGN KEY ("homePlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_awayPlayerId_fkey" FOREIGN KEY ("awayPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
