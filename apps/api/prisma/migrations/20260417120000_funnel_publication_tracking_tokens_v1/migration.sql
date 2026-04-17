ALTER TABLE "FunnelPublication"
ADD COLUMN IF NOT EXISTS "metaCapiToken" TEXT,
ADD COLUMN IF NOT EXISTS "tiktokAccessToken" TEXT;
