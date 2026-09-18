-- AlterTable
ALTER TABLE "JoinRequest" ADD COLUMN     "role" "LeagueRole" NOT NULL DEFAULT 'PLAYER';

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "inviteToken" TEXT;

-- CreateTable
CREATE TABLE "ManagerInvite" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,

    CONSTRAINT "ManagerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerInvite_tokenHash_key" ON "ManagerInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "ManagerInvite_leagueId_idx" ON "ManagerInvite"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "League_inviteToken_key" ON "League"("inviteToken");

-- AddForeignKey
ALTER TABLE "ManagerInvite" ADD CONSTRAINT "ManagerInvite_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
