-- AlterTable
ALTER TABLE "Funnel" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "subscriptionExpiresAt" TIMESTAMP(3);
