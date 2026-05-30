-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventVersion" TEXT NOT NULL DEFAULT '1.0',
    "eventFamily" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "domainId" TEXT,
    "funnelPublicationId" TEXT,
    "funnelInstanceId" TEXT,
    "funnelStepId" TEXT,
    "leadId" TEXT,
    "visitorId" TEXT,
    "assignmentId" TEXT,
    "trackedLinkId" TEXT,
    "actionLinkKey" TEXT,
    "trafficLayer" TEXT NOT NULL,
    "attributionJson" JSONB,
    "payloadJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FunnelEvent_eventId_key" ON "FunnelEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelEvent_dedupeKey_key" ON "FunnelEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "FunnelEvent_workspaceId_teamId_occurredAt_idx" ON "FunnelEvent"("workspaceId", "teamId", "occurredAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_funnelPublicationId_eventName_occurredAt_idx" ON "FunnelEvent"("funnelPublicationId", "eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_leadId_occurredAt_idx" ON "FunnelEvent"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_visitorId_occurredAt_idx" ON "FunnelEvent"("visitorId", "occurredAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_assignmentId_occurredAt_idx" ON "FunnelEvent"("assignmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_trackedLinkId_occurredAt_idx" ON "FunnelEvent"("trackedLinkId", "occurredAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_trafficLayer_eventName_receivedAt_idx" ON "FunnelEvent"("trafficLayer", "eventName", "receivedAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_eventFamily_eventName_occurredAt_idx" ON "FunnelEvent"("eventFamily", "eventName", "occurredAt");

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_funnelPublicationId_fkey" FOREIGN KEY ("funnelPublicationId") REFERENCES "FunnelPublication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_funnelInstanceId_fkey" FOREIGN KEY ("funnelInstanceId") REFERENCES "FunnelInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_funnelStepId_fkey" FOREIGN KEY ("funnelStepId") REFERENCES "FunnelStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_trackedLinkId_fkey" FOREIGN KEY ("trackedLinkId") REFERENCES "TrackedLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
