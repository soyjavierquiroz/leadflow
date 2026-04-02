-- AlterTable
ALTER TABLE "FunnelPublication" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "FunnelPublication"
SET "isActive" = CASE
  WHEN "status" = 'active' THEN true
  ELSE false
END;
