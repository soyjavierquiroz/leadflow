-- CreateEnum
CREATE TYPE "AdWheelStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "AdWheel" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "AdWheelStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "seatPrice" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdWheel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdWheelParticipant" (
    "adWheelId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdWheelParticipant_pkey" PRIMARY KEY ("adWheelId","sponsorId")
);

-- CreateIndex
CREATE INDEX "AdWheel_teamId_status_idx" ON "AdWheel"("teamId", "status");

-- CreateIndex
CREATE INDEX "AdWheel_teamId_startDate_endDate_idx" ON "AdWheel"("teamId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "AdWheelParticipant_sponsorId_joinedAt_idx" ON "AdWheelParticipant"("sponsorId", "joinedAt");

-- AddForeignKey
ALTER TABLE "AdWheel" ADD CONSTRAINT "AdWheel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdWheelParticipant" ADD CONSTRAINT "AdWheelParticipant_adWheelId_fkey" FOREIGN KEY ("adWheelId") REFERENCES "AdWheel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdWheelParticipant" ADD CONSTRAINT "AdWheelParticipant_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
