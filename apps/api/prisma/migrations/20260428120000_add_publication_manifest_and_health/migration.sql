-- CreateEnum
CREATE TYPE "FunnelRuntimeHealthStatus" AS ENUM ('healthy', 'warning', 'broken');

-- AlterTable
ALTER TABLE "FunnelPublication"
ADD COLUMN "seoTitle" TEXT,
ADD COLUMN "seoDescription" TEXT,
ADD COLUMN "ogImageUrl" TEXT,
ADD COLUMN "faviconUrl" TEXT,
ADD COLUMN "manifestVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "runtimeHealthStatus" "FunnelRuntimeHealthStatus" NOT NULL DEFAULT 'healthy';

-- CreateIndex
CREATE INDEX "FunnelPublication_runtimeHealthStatus_status_idx"
ON "FunnelPublication"("runtimeHealthStatus", "status");
