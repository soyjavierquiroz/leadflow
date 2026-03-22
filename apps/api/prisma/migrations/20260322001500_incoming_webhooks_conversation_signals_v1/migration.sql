CREATE TYPE "ConversationSignalSource" AS ENUM ('n8n', 'evolution');
CREATE TYPE "ConversationSignalType" AS ENUM ('conversation_started', 'message_inbound', 'message_outbound', 'lead_contacted', 'lead_qualified', 'lead_follow_up', 'lead_won', 'lead_lost');
CREATE TYPE "ConversationSignalProcessingStatus" AS ENUM ('received', 'applied', 'ignored', 'failed');

CREATE TABLE "ConversationSignal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sponsorId" TEXT,
    "leadId" TEXT,
    "assignmentId" TEXT,
    "messagingConnectionId" TEXT,
    "automationDispatchId" TEXT,
    "source" "ConversationSignalSource" NOT NULL,
    "signalType" "ConversationSignalType" NOT NULL,
    "processingStatus" "ConversationSignalProcessingStatus" NOT NULL,
    "externalEventId" TEXT,
    "payloadSnapshot" JSONB NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "leadStatusAfter" "LeadStatus",
    "assignmentStatusAfter" "AssignmentStatus",
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationSignal_workspaceId_source_occurredAt_idx" ON "ConversationSignal"("workspaceId", "source", "occurredAt");
CREATE INDEX "ConversationSignal_leadId_occurredAt_idx" ON "ConversationSignal"("leadId", "occurredAt");
CREATE INDEX "ConversationSignal_assignmentId_occurredAt_idx" ON "ConversationSignal"("assignmentId", "occurredAt");
CREATE INDEX "ConversationSignal_sponsorId_occurredAt_idx" ON "ConversationSignal"("sponsorId", "occurredAt");
CREATE INDEX "ConversationSignal_messagingConnectionId_occurredAt_idx" ON "ConversationSignal"("messagingConnectionId", "occurredAt");
CREATE INDEX "ConversationSignal_automationDispatchId_occurredAt_idx" ON "ConversationSignal"("automationDispatchId", "occurredAt");

ALTER TABLE "ConversationSignal" ADD CONSTRAINT "ConversationSignal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationSignal" ADD CONSTRAINT "ConversationSignal_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationSignal" ADD CONSTRAINT "ConversationSignal_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationSignal" ADD CONSTRAINT "ConversationSignal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationSignal" ADD CONSTRAINT "ConversationSignal_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationSignal" ADD CONSTRAINT "ConversationSignal_messagingConnectionId_fkey" FOREIGN KEY ("messagingConnectionId") REFERENCES "MessagingConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationSignal" ADD CONSTRAINT "ConversationSignal_automationDispatchId_fkey" FOREIGN KEY ("automationDispatchId") REFERENCES "AutomationDispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
