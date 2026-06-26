-- CreateEnum
CREATE TYPE "LibraryCollectionStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "LibraryAssetType" AS ENUM ('funnel', 'funnel_pack', 'block', 'section', 'theme', 'brand_kit', 'ai_agent', 'prompt_pack', 'automation', 'crm_playbook', 'whatsapp_flow', 'email_sequence', 'other');

-- CreateEnum
CREATE TYPE "LibraryOwnerType" AS ENUM ('system');

-- CreateEnum
CREATE TYPE "LibraryVisibility" AS ENUM ('private', 'internal', 'public');

-- CreateEnum
CREATE TYPE "LibraryAssetStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "LibraryAssetVersionStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "LibraryMediaType" AS ENUM ('thumbnail', 'cover', 'gallery', 'video', 'gif', 'icon');

-- CreateTable
CREATE TABLE "LibraryCollection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assetType" "LibraryAssetType",
    "status" "LibraryCollectionStatus" NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryAsset" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assetType" "LibraryAssetType" NOT NULL,
    "ownerType" "LibraryOwnerType" NOT NULL DEFAULT 'system',
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'internal',
    "status" "LibraryAssetStatus" NOT NULL DEFAULT 'draft',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryAssetVersion" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "LibraryAssetVersionStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "changeLog" TEXT,
    "sourceReferenceId" TEXT,
    "previewConfig" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryAssetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryTag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryAssetTag" (
    "assetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "LibraryAssetTag_pkey" PRIMARY KEY ("assetId","tagId")
);

-- CreateTable
CREATE TABLE "LibraryCompatibility" (
    "id" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "vertical" TEXT,
    "industry" TEXT,
    "businessModel" TEXT,
    "blueprint" TEXT,
    "country" TEXT,
    "language" TEXT,
    "accountType" TEXT,
    "market" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryMedia" (
    "id" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "mediaType" "LibraryMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryFunnelVersion" (
    "id" TEXT NOT NULL,
    "assetVersionId" TEXT NOT NULL,
    "sourceFunnelInstanceId" TEXT,
    "sourceFunnelId" TEXT,
    "stepsCount" INTEGER,
    "framework" TEXT,
    "difficulty" TEXT,
    "estimatedMinutes" INTEGER,
    "flowSummary" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryFunnelVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FunnelArsenalTemplate" ADD COLUMN "libraryAssetVersionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCollection_slug_key" ON "LibraryCollection"("slug");

-- CreateIndex
CREATE INDEX "LibraryCollection_status_sortOrder_idx" ON "LibraryCollection"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryAsset_collectionId_slug_key" ON "LibraryAsset"("collectionId", "slug");

-- CreateIndex
CREATE INDEX "LibraryAsset_slug_idx" ON "LibraryAsset"("slug");

-- CreateIndex
CREATE INDEX "LibraryAsset_assetType_status_idx" ON "LibraryAsset"("assetType", "status");

-- CreateIndex
CREATE INDEX "LibraryAsset_visibility_status_idx" ON "LibraryAsset"("visibility", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryAssetVersion_assetId_version_key" ON "LibraryAssetVersion"("assetId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryAssetVersion_one_published_per_asset_idx" ON "LibraryAssetVersion"("assetId") WHERE "status" = 'published';

-- CreateIndex
CREATE INDEX "LibraryAssetVersion_assetId_status_idx" ON "LibraryAssetVersion"("assetId", "status");

-- CreateIndex
CREATE INDEX "LibraryAssetVersion_sourceReferenceId_idx" ON "LibraryAssetVersion"("sourceReferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryTag_slug_key" ON "LibraryTag"("slug");

-- CreateIndex
CREATE INDEX "LibraryAssetTag_tagId_idx" ON "LibraryAssetTag"("tagId");

-- CreateIndex
CREATE INDEX "LibraryCompatibility_assetVersionId_idx" ON "LibraryCompatibility"("assetVersionId");

-- CreateIndex
CREATE INDEX "LibraryCompatibility_vertical_industry_idx" ON "LibraryCompatibility"("vertical", "industry");

-- CreateIndex
CREATE INDEX "LibraryCompatibility_businessModel_idx" ON "LibraryCompatibility"("businessModel");

-- CreateIndex
CREATE INDEX "LibraryCompatibility_blueprint_idx" ON "LibraryCompatibility"("blueprint");

-- CreateIndex
CREATE INDEX "LibraryCompatibility_country_language_idx" ON "LibraryCompatibility"("country", "language");

-- CreateIndex
CREATE INDEX "LibraryCompatibility_accountType_idx" ON "LibraryCompatibility"("accountType");

-- CreateIndex
CREATE INDEX "LibraryCompatibility_market_idx" ON "LibraryCompatibility"("market");

-- CreateIndex
CREATE INDEX "LibraryMedia_assetVersionId_mediaType_sortOrder_idx" ON "LibraryMedia"("assetVersionId", "mediaType", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryFunnelVersion_assetVersionId_key" ON "LibraryFunnelVersion"("assetVersionId");

-- CreateIndex
CREATE INDEX "LibraryFunnelVersion_sourceFunnelInstanceId_idx" ON "LibraryFunnelVersion"("sourceFunnelInstanceId");

-- CreateIndex
CREATE INDEX "LibraryFunnelVersion_sourceFunnelId_idx" ON "LibraryFunnelVersion"("sourceFunnelId");

-- CreateIndex
CREATE INDEX "LibraryFunnelVersion_framework_idx" ON "LibraryFunnelVersion"("framework");

-- CreateIndex
CREATE INDEX "LibraryFunnelVersion_difficulty_idx" ON "LibraryFunnelVersion"("difficulty");

-- CreateIndex
CREATE INDEX "FunnelArsenalTemplate_libraryAssetVersionId_idx" ON "FunnelArsenalTemplate"("libraryAssetVersionId");

-- AddForeignKey
ALTER TABLE "LibraryAsset" ADD CONSTRAINT "LibraryAsset_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "LibraryCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryAssetVersion" ADD CONSTRAINT "LibraryAssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "LibraryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryAssetTag" ADD CONSTRAINT "LibraryAssetTag_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "LibraryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryAssetTag" ADD CONSTRAINT "LibraryAssetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "LibraryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCompatibility" ADD CONSTRAINT "LibraryCompatibility_assetVersionId_fkey" FOREIGN KEY ("assetVersionId") REFERENCES "LibraryAssetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryMedia" ADD CONSTRAINT "LibraryMedia_assetVersionId_fkey" FOREIGN KEY ("assetVersionId") REFERENCES "LibraryAssetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFunnelVersion" ADD CONSTRAINT "LibraryFunnelVersion_assetVersionId_fkey" FOREIGN KEY ("assetVersionId") REFERENCES "LibraryAssetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelArsenalTemplate" ADD CONSTRAINT "FunnelArsenalTemplate_libraryAssetVersionId_fkey" FOREIGN KEY ("libraryAssetVersionId") REFERENCES "LibraryAssetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
