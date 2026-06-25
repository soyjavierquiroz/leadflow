-- AlterTable
ALTER TABLE "FunnelArsenalTemplate"
ADD COLUMN "industry" TEXT,
ADD COLUMN "businessModel" TEXT,
ADD COLUMN "funnelType" TEXT,
ADD COLUMN "funnelFormat" TEXT,
ADD COLUMN "objective" TEXT,
ADD COLUMN "stepsCount" INTEGER,
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN "country" TEXT,
ADD COLUMN "market" TEXT;

-- CreateIndex
CREATE INDEX "FunnelArsenalTemplate_industry_status_idx" ON "FunnelArsenalTemplate"("industry", "status");

-- CreateIndex
CREATE INDEX "FunnelArsenalTemplate_funnelType_status_idx" ON "FunnelArsenalTemplate"("funnelType", "status");

-- CreateIndex
CREATE INDEX "FunnelArsenalTemplate_objective_status_idx" ON "FunnelArsenalTemplate"("objective", "status");

-- CreateIndex
CREATE INDEX "FunnelArsenalTemplate_language_status_idx" ON "FunnelArsenalTemplate"("language", "status");

-- CreateIndex
CREATE INDEX "FunnelArsenalTemplate_market_status_idx" ON "FunnelArsenalTemplate"("market", "status");
