-- CreateEnum
CREATE TYPE "TrackedLinkStatus" AS ENUM ('active', 'revoked', 'expired', 'deleted');

-- CreateTable
CREATE TABLE "TrackedLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "ownershipKey" TEXT,
    "funnelPublicationId" TEXT NOT NULL,
    "funnelInstanceId" TEXT NOT NULL,
    "funnelStepId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "appKey" TEXT NOT NULL DEFAULT 'leadflow',
    "action" TEXT NOT NULL DEFAULT 'open_vsl',
    "purpose" TEXT NOT NULL DEFAULT 'vsl_followup',
    "longUrl" TEXT NOT NULL,
    "shortUrl" TEXT,
    "shortCode" TEXT,
    "shortLinkProvider" TEXT NOT NULL,
    "ctxTokenHash" TEXT NOT NULL,
    "status" "TrackedLinkStatus" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedLink_ctxTokenHash_key" ON "TrackedLink"("ctxTokenHash");

-- CreateIndex
CREATE INDEX "TrackedLink_leadId_status_idx" ON "TrackedLink"("leadId", "status");

-- CreateIndex
CREATE INDEX "TrackedLink_assignmentId_status_idx" ON "TrackedLink"("assignmentId", "status");

-- CreateIndex
CREATE INDEX "TrackedLink_ownershipKey_idx" ON "TrackedLink"("ownershipKey");

-- CreateIndex
CREATE INDEX "TrackedLink_shortCode_idx" ON "TrackedLink"("shortCode");

-- CreateIndex
CREATE INDEX "TrackedLink_funnelPublicationId_funnelStepId_status_idx" ON "TrackedLink"("funnelPublicationId", "funnelStepId", "status");

-- CreateIndex
CREATE INDEX "TrackedLink_workspaceId_status_createdAt_idx" ON "TrackedLink"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedLink_active_idempotency_key"
ON "TrackedLink" (
  "leadId",
  COALESCE("assignmentId", ''),
  "funnelStepId",
  "purpose"
)
WHERE "status" = 'active';

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_funnelPublicationId_fkey" FOREIGN KEY ("funnelPublicationId") REFERENCES "FunnelPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_funnelInstanceId_fkey" FOREIGN KEY ("funnelInstanceId") REFERENCES "FunnelInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_funnelStepId_fkey" FOREIGN KEY ("funnelStepId") REFERENCES "FunnelStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
