CREATE TYPE "AutomationDispatchStatus" AS ENUM ('pending', 'skipped', 'dispatched', 'failed');

CREATE TABLE "AutomationDispatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "funnelInstanceId" TEXT,
    "funnelPublicationId" TEXT,
    "messagingConnectionId" TEXT,
    "triggerType" TEXT NOT NULL,
    "status" "AutomationDispatchStatus" NOT NULL,
    "targetWebhookUrl" TEXT,
    "payloadSnapshot" JSONB NOT NULL,
    "responseSnapshot" JSONB,
    "responseStatusCode" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationDispatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationDispatch_workspaceId_status_createdAt_idx" ON "AutomationDispatch"("workspaceId", "status", "createdAt");
CREATE INDEX "AutomationDispatch_sponsorId_createdAt_idx" ON "AutomationDispatch"("sponsorId", "createdAt");
CREATE INDEX "AutomationDispatch_assignmentId_createdAt_idx" ON "AutomationDispatch"("assignmentId", "createdAt");
CREATE INDEX "AutomationDispatch_messagingConnectionId_createdAt_idx" ON "AutomationDispatch"("messagingConnectionId", "createdAt");

ALTER TABLE "AutomationDispatch" ADD CONSTRAINT "AutomationDispatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationDispatch" ADD CONSTRAINT "AutomationDispatch_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationDispatch" ADD CONSTRAINT "AutomationDispatch_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationDispatch" ADD CONSTRAINT "AutomationDispatch_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationDispatch" ADD CONSTRAINT "AutomationDispatch_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationDispatch" ADD CONSTRAINT "AutomationDispatch_funnelInstanceId_fkey" FOREIGN KEY ("funnelInstanceId") REFERENCES "FunnelInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationDispatch" ADD CONSTRAINT "AutomationDispatch_funnelPublicationId_fkey" FOREIGN KEY ("funnelPublicationId") REFERENCES "FunnelPublication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationDispatch" ADD CONSTRAINT "AutomationDispatch_messagingConnectionId_fkey" FOREIGN KEY ("messagingConnectionId") REFERENCES "MessagingConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
