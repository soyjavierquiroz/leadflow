-- CreateEnum
CREATE TYPE "DomainType" AS ENUM (
    'system_subdomain',
    'custom_apex',
    'custom_subdomain'
);

-- AlterTable
ALTER TABLE "Domain"
ADD COLUMN     "normalizedHost" TEXT,
ADD COLUMN     "domainType" "DomainType",
ADD COLUMN     "canonicalHost" TEXT,
ADD COLUMN     "redirectToPrimary" BOOLEAN NOT NULL DEFAULT false;

-- Backfill
UPDATE "Domain"
SET
  "normalizedHost" = LOWER(REGEXP_REPLACE("host", ':\d+$', '')),
  "domainType" = CASE
    WHEN "kind" = 'subdomain' THEN 'system_subdomain'::"DomainType"
    WHEN "kind" = 'custom' THEN 'custom_subdomain'::"DomainType"
    ELSE 'custom_apex'::"DomainType"
  END,
  "canonicalHost" = LOWER(REGEXP_REPLACE("host", ':\d+$', ''));

-- AlterTable
ALTER TABLE "Domain"
ALTER COLUMN "normalizedHost" SET NOT NULL,
ALTER COLUMN "domainType" SET NOT NULL;

-- DropIndex
DROP INDEX "Domain_host_key";

-- AlterTable
ALTER TABLE "Domain"
DROP COLUMN "kind";

-- DropEnum
DROP TYPE "DomainKind";

-- CreateIndex
CREATE UNIQUE INDEX "Domain_normalizedHost_key" ON "Domain"("normalizedHost");

-- CreateIndex
CREATE INDEX "Domain_teamId_isPrimary_idx" ON "Domain"("teamId", "isPrimary");

-- CreateIndex
CREATE INDEX "FunnelPublication_domainId_status_pathPrefix_idx" ON "FunnelPublication"("domainId", "status", "pathPrefix");
