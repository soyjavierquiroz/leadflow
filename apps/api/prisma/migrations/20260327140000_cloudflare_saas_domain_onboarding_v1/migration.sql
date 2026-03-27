-- CreateEnum
CREATE TYPE "DomainOnboardingStatus" AS ENUM (
    'draft',
    'pending_dns',
    'pending_validation',
    'active',
    'error'
);

-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM (
    'unverified',
    'pending',
    'verified',
    'failed'
);

-- CreateEnum
CREATE TYPE "DomainSslStatus" AS ENUM (
    'unconfigured',
    'pending',
    'active',
    'failed'
);

-- CreateEnum
CREATE TYPE "DomainVerificationMethod" AS ENUM (
    'none',
    'cname',
    'txt',
    'http'
);

-- AlterTable
ALTER TABLE "Domain"
ADD COLUMN     "onboardingStatus" "DomainOnboardingStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN     "verificationStatus" "DomainVerificationStatus" NOT NULL DEFAULT 'unverified',
ADD COLUMN     "sslStatus" "DomainSslStatus" NOT NULL DEFAULT 'unconfigured',
ADD COLUMN     "verificationMethod" "DomainVerificationMethod" NOT NULL DEFAULT 'none',
ADD COLUMN     "cloudflareCustomHostnameId" TEXT,
ADD COLUMN     "cloudflareStatusJson" JSONB,
ADD COLUMN     "dnsTarget" TEXT,
ADD COLUMN     "lastCloudflareSyncAt" TIMESTAMP(3),
ADD COLUMN     "activatedAt" TIMESTAMP(3);

-- Backfill
UPDATE "Domain"
SET
  "onboardingStatus" = CASE
    WHEN "status" = 'active' THEN 'active'::"DomainOnboardingStatus"
    ELSE 'draft'::"DomainOnboardingStatus"
  END,
  "verificationStatus" = CASE
    WHEN "domainType" = 'system_subdomain' OR "status" = 'active' THEN 'verified'::"DomainVerificationStatus"
    ELSE 'unverified'::"DomainVerificationStatus"
  END,
  "sslStatus" = CASE
    WHEN "domainType" = 'system_subdomain' OR "status" = 'active' THEN 'active'::"DomainSslStatus"
    ELSE 'unconfigured'::"DomainSslStatus"
  END,
  "verificationMethod" = CASE
    WHEN "domainType" = 'custom_subdomain' THEN 'cname'::"DomainVerificationMethod"
    WHEN "domainType" = 'custom_apex' THEN 'txt'::"DomainVerificationMethod"
    ELSE 'none'::"DomainVerificationMethod"
  END,
  "activatedAt" = CASE
    WHEN "status" = 'active' THEN CURRENT_TIMESTAMP
    ELSE NULL
  END;

-- CreateIndex
CREATE UNIQUE INDEX "Domain_cloudflareCustomHostnameId_key" ON "Domain"("cloudflareCustomHostnameId");

-- CreateIndex
CREATE INDEX "Domain_teamId_onboardingStatus_idx" ON "Domain"("teamId", "onboardingStatus");
