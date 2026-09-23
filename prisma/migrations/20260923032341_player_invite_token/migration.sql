-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "inviteToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Player_inviteToken_key" ON "Player"("inviteToken");
