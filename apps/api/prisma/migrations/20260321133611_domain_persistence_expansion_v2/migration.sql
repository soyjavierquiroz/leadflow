-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "DomainKind" AS ENUM ('apex', 'subdomain', 'custom');

-- CreateEnum
CREATE TYPE "FunnelTemplateStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "FunnelInstanceStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "FunnelStepType" AS ENUM ('landing', 'lead_capture', 'thank_you', 'vsl', 'presentation', 'qualification', 'cta_bridge', 'handoff', 'confirmation', 'redirect');

-- CreateEnum
CREATE TYPE "FunnelPublicationStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "TrackingProvider" AS ENUM ('meta', 'tiktok', 'custom');

-- CreateEnum
CREATE TYPE "TrackingProfileStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "DeduplicationMode" AS ENUM ('browser_server', 'browser_only', 'server_only');

-- CreateEnum
CREATE TYPE "HandoffStrategyStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "HandoffStrategyType" AS ENUM ('immediate_whatsapp', 'immediate_internal_assignment', 'deferred_queue', 'deferred_review', 'scheduled_followup', 'content_continuation');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventAggregateType" ADD VALUE 'domain';
ALTER TYPE "EventAggregateType" ADD VALUE 'funnel_template';
ALTER TYPE "EventAggregateType" ADD VALUE 'funnel_instance';
ALTER TYPE "EventAggregateType" ADD VALUE 'funnel_step';
ALTER TYPE "EventAggregateType" ADD VALUE 'funnel_publication';
ALTER TYPE "EventAggregateType" ADD VALUE 'tracking_profile';
ALTER TYPE "EventAggregateType" ADD VALUE 'conversion_event_mapping';
ALTER TYPE "EventAggregateType" ADD VALUE 'handoff_strategy';

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "funnelInstanceId" TEXT,
ADD COLUMN     "funnelPublicationId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "funnelInstanceId" TEXT,
ADD COLUMN     "funnelPublicationId" TEXT;

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL,
    "kind" "DomainKind" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "FunnelTemplateStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "funnelType" TEXT NOT NULL,
    "blocksJson" JSONB NOT NULL,
    "mediaMap" JSONB NOT NULL,
    "settingsJson" JSONB NOT NULL,
    "allowedOverridesJson" JSONB NOT NULL,
    "defaultHandoffStrategyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelInstance" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "legacyFunnelId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "FunnelInstanceStatus" NOT NULL,
    "rotationPoolId" TEXT,
    "trackingProfileId" TEXT,
    "handoffStrategyId" TEXT,
    "settingsJson" JSONB NOT NULL,
    "mediaMap" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelStep" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "funnelInstanceId" TEXT NOT NULL,
    "stepType" "FunnelStepType" NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isEntryStep" BOOLEAN NOT NULL DEFAULT false,
    "isConversionStep" BOOLEAN NOT NULL DEFAULT false,
    "blocksJson" JSONB NOT NULL,
    "mediaMap" JSONB NOT NULL,
    "settingsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelPublication" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "funnelInstanceId" TEXT NOT NULL,
    "trackingProfileId" TEXT,
    "handoffStrategyId" TEXT,
    "pathPrefix" TEXT NOT NULL,
    "status" "FunnelPublicationStatus" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "TrackingProvider" NOT NULL,
    "status" "TrackingProfileStatus" NOT NULL,
    "configJson" JSONB NOT NULL,
    "deduplicationMode" "DeduplicationMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionEventMapping" (
    "id" TEXT NOT NULL,
    "trackingProfileId" TEXT NOT NULL,
    "internalEventName" TEXT NOT NULL,
    "providerEventName" TEXT NOT NULL,
    "isBrowserSide" BOOLEAN NOT NULL DEFAULT true,
    "isServerSide" BOOLEAN NOT NULL DEFAULT false,
    "isCriticalConversion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionEventMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoffStrategy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "type" "HandoffStrategyType" NOT NULL,
    "status" "HandoffStrategyStatus" NOT NULL,
    "settingsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoffStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Domain_host_key" ON "Domain"("host");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelTemplate_code_key" ON "FunnelTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelInstance_legacyFunnelId_key" ON "FunnelInstance"("legacyFunnelId");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelInstance_teamId_code_key" ON "FunnelInstance"("teamId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelStep_funnelInstanceId_position_key" ON "FunnelStep"("funnelInstanceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelStep_funnelInstanceId_slug_key" ON "FunnelStep"("funnelInstanceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelPublication_domainId_pathPrefix_key" ON "FunnelPublication"("domainId", "pathPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingProfile_teamId_name_key" ON "TrackingProfile"("teamId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEventMapping_trackingProfileId_internalEventName__key" ON "ConversionEventMapping"("trackingProfileId", "internalEventName", "providerEventName");

-- CreateIndex
CREATE UNIQUE INDEX "HandoffStrategy_workspaceId_teamId_name_key" ON "HandoffStrategy"("workspaceId", "teamId", "name");

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelTemplate" ADD CONSTRAINT "FunnelTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelTemplate" ADD CONSTRAINT "FunnelTemplate_defaultHandoffStrategyId_fkey" FOREIGN KEY ("defaultHandoffStrategyId") REFERENCES "HandoffStrategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelInstance" ADD CONSTRAINT "FunnelInstance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelInstance" ADD CONSTRAINT "FunnelInstance_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelInstance" ADD CONSTRAINT "FunnelInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FunnelTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelInstance" ADD CONSTRAINT "FunnelInstance_legacyFunnelId_fkey" FOREIGN KEY ("legacyFunnelId") REFERENCES "Funnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelInstance" ADD CONSTRAINT "FunnelInstance_rotationPoolId_fkey" FOREIGN KEY ("rotationPoolId") REFERENCES "RotationPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelInstance" ADD CONSTRAINT "FunnelInstance_trackingProfileId_fkey" FOREIGN KEY ("trackingProfileId") REFERENCES "TrackingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelInstance" ADD CONSTRAINT "FunnelInstance_handoffStrategyId_fkey" FOREIGN KEY ("handoffStrategyId") REFERENCES "HandoffStrategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelStep" ADD CONSTRAINT "FunnelStep_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelStep" ADD CONSTRAINT "FunnelStep_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelStep" ADD CONSTRAINT "FunnelStep_funnelInstanceId_fkey" FOREIGN KEY ("funnelInstanceId") REFERENCES "FunnelInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelPublication" ADD CONSTRAINT "FunnelPublication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelPublication" ADD CONSTRAINT "FunnelPublication_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelPublication" ADD CONSTRAINT "FunnelPublication_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelPublication" ADD CONSTRAINT "FunnelPublication_funnelInstanceId_fkey" FOREIGN KEY ("funnelInstanceId") REFERENCES "FunnelInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelPublication" ADD CONSTRAINT "FunnelPublication_trackingProfileId_fkey" FOREIGN KEY ("trackingProfileId") REFERENCES "TrackingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelPublication" ADD CONSTRAINT "FunnelPublication_handoffStrategyId_fkey" FOREIGN KEY ("handoffStrategyId") REFERENCES "HandoffStrategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingProfile" ADD CONSTRAINT "TrackingProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingProfile" ADD CONSTRAINT "TrackingProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEventMapping" ADD CONSTRAINT "ConversionEventMapping_trackingProfileId_fkey" FOREIGN KEY ("trackingProfileId") REFERENCES "TrackingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffStrategy" ADD CONSTRAINT "HandoffStrategy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffStrategy" ADD CONSTRAINT "HandoffStrategy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_funnelInstanceId_fkey" FOREIGN KEY ("funnelInstanceId") REFERENCES "FunnelInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_funnelPublicationId_fkey" FOREIGN KEY ("funnelPublicationId") REFERENCES "FunnelPublication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_funnelInstanceId_fkey" FOREIGN KEY ("funnelInstanceId") REFERENCES "FunnelInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_funnelPublicationId_fkey" FOREIGN KEY ("funnelPublicationId") REFERENCES "FunnelPublication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
