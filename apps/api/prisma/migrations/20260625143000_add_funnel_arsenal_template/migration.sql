-- CreateEnum
CREATE TYPE "FunnelArsenalTemplateStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateTable
CREATE TABLE "FunnelArsenalTemplate" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "blueprintKey" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "recommendedFor" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "pathSuggestion" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "status" "FunnelArsenalTemplateStatus" NOT NULL DEFAULT 'draft',
    "blocksPresetKey" TEXT,
    "funnelTemplateId" TEXT,
    "sourceFunnelId" TEXT,
    "sourceFunnelInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelArsenalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FunnelArsenalTemplate_templateKey_key" ON "FunnelArsenalTemplate"("templateKey");

-- CreateIndex
CREATE INDEX "FunnelArsenalTemplate_blueprintKey_status_idx" ON "FunnelArsenalTemplate"("blueprintKey", "status");

-- CreateIndex
CREATE INDEX "FunnelArsenalTemplate_vertical_status_idx" ON "FunnelArsenalTemplate"("vertical", "status");

-- CreateIndex
CREATE INDEX "FunnelArsenalTemplate_sourceFunnelInstanceId_idx" ON "FunnelArsenalTemplate"("sourceFunnelInstanceId");

-- CreateIndex
CREATE INDEX "FunnelArsenalTemplate_sourceFunnelId_idx" ON "FunnelArsenalTemplate"("sourceFunnelId");
