-- AlterTable
ALTER TABLE "Sponsor" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "maxSeats" INTEGER NOT NULL DEFAULT 10;
