ALTER TABLE "FunnelArsenalTemplate"
  ADD COLUMN "assetSlug" TEXT,
  ADD COLUMN "subindustry" TEXT,
  ADD COLUMN "framework" TEXT,
  ADD COLUMN "level" TEXT,
  ADD COLUMN "estimatedTimeMinutes" INTEGER,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "coverUrl" TEXT,
  ADD COLUMN "thumbnailUrl" TEXT,
  ADD COLUMN "screenshotsJson" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "videoPreviewUrl" TEXT,
  ADD COLUMN "headline" TEXT,
  ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN "authorName" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "problemSolved" TEXT,
  ADD COLUMN "idealFor" TEXT,
  ADD COLUMN "flowSummaryJson" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "compatibleBlueprints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "assetsJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "mediaJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "historyJson" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "cloneCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "activeInstallations" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastActivatedAt" TIMESTAMP(3),
  ADD COLUMN "favoriteCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "FunnelArsenalTemplate"
SET
  "assetSlug" = "templateKey",
  "headline" = "label",
  "level" = "difficulty",
  "compatibleBlueprints" = ARRAY["blueprintKey"],
  "flowSummaryJson" = jsonb_build_array(
    jsonb_build_object('label', 'Landing', 'description', "description"),
    jsonb_build_object('label', 'Captura', 'description', "cta")
  )
WHERE "assetSlug" IS NULL;

CREATE UNIQUE INDEX "FunnelArsenalTemplate_assetSlug_key" ON "FunnelArsenalTemplate"("assetSlug");
CREATE INDEX "FunnelArsenalTemplate_assetSlug_idx" ON "FunnelArsenalTemplate"("assetSlug");
CREATE INDEX "FunnelArsenalTemplate_framework_status_idx" ON "FunnelArsenalTemplate"("framework", "status");
CREATE INDEX "FunnelArsenalTemplate_level_status_idx" ON "FunnelArsenalTemplate"("level", "status");
