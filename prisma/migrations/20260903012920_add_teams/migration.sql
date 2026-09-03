/*
  Warnings:

  - You are about to drop the column `awayLabel` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `homeLabel` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `leagueId` on the `Player` table. All the data in the column will be lost.
  - Added the required column `awayTeamId` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `homeTeamId` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teamId` to the `Player` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_leagueId_fkey";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "awayLabel",
DROP COLUMN "homeLabel",
ADD COLUMN     "awayTeamId" TEXT NOT NULL,
ADD COLUMN     "homeTeamId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "leagueId",
ADD COLUMN     "teamId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
