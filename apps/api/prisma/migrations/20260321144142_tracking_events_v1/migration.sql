-- AlterTable
ALTER TABLE "DomainEvent" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "funnelInstanceId" TEXT,
ADD COLUMN     "funnelPublicationId" TEXT,
ADD COLUMN     "funnelStepId" TEXT;

UPDATE "DomainEvent"
SET "eventId" = "id"
WHERE "eventId" IS NULL;

ALTER TABLE "DomainEvent"
ALTER COLUMN "eventId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "DomainEvent_eventId_idx" ON "DomainEvent"("eventId");

-- CreateIndex
CREATE INDEX "DomainEvent_workspaceId_eventName_occurredAt_idx" ON "DomainEvent"("workspaceId", "eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_leadId_occurredAt_idx" ON "DomainEvent"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_funnelPublicationId_occurredAt_idx" ON "DomainEvent"("funnelPublicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_funnelInstanceId_occurredAt_idx" ON "DomainEvent"("funnelInstanceId", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_visitorId_occurredAt_idx" ON "DomainEvent"("visitorId", "occurredAt");
