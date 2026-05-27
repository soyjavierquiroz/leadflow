-- CreateEnum
CREATE TYPE "CrmAssignmentStatus" AS ENUM ('pending_assignment', 'accepted', 'auto_accepted', 'expired', 'reassigned', 'closed');

-- CreateEnum
CREATE TYPE "CrmAssignmentSource" AS ENUM ('wheel', 'organic', 'whatsapp_inbound', 'manual', 'campaign', 'reassignment');

-- CreateEnum
CREATE TYPE "CrmAssignmentEventType" AS ENUM ('assignment_created', 'assignment_accepted', 'assignment_auto_accepted', 'ownership_changed', 'assignment_expired', 'assignment_reassigned', 'conversation_detected');

-- CreateEnum
CREATE TYPE "CrmOutreachStatus" AS ENUM ('queued', 'scheduled', 'blocked', 'processing', 'dispatched', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CrmOutreachIntentType" AS ENUM ('initial_contact', 'followup', 'reactivation');

-- CreateTable
CREATE TABLE "crm_lead_assignments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "attributed_sponsor_id" TEXT,
    "assigned_sponsor_id" TEXT,
    "accepted_by_sponsor_id" TEXT,
    "conversation_owner_sponsor_id" TEXT,
    "assignment_status" "CrmAssignmentStatus" NOT NULL,
    "assignment_source" "CrmAssignmentSource" NOT NULL,
    "ownership_locked_until" TIMESTAMP(3),
    "assigned_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "last_conversation_at" TIMESTAMP(3),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_assignment_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "event_type" "CrmAssignmentEventType" NOT NULL,
    "actor_sponsor_id" TEXT,
    "source" "CrmAssignmentSource" NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_assignment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_outreach_queue" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "sponsor_id" TEXT NOT NULL,
    "intent_type" "CrmOutreachIntentType" NOT NULL,
    "status" "CrmOutreachStatus" NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "randomized_delay_ms" INTEGER,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_outreach_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_lead_assignments_scope_status_idx" ON "crm_lead_assignments"("workspace_id", "team_id", "assignment_status");

-- CreateIndex
CREATE INDEX "crm_lead_assignments_lead_status_idx" ON "crm_lead_assignments"("lead_id", "assignment_status");

-- CreateIndex
CREATE INDEX "crm_lead_assignments_assigned_sponsor_status_idx" ON "crm_lead_assignments"("assigned_sponsor_id", "assignment_status");

-- CreateIndex
CREATE INDEX "crm_lead_assignments_conversation_owner_status_idx" ON "crm_lead_assignments"("conversation_owner_sponsor_id", "assignment_status");

-- CreateIndex
CREATE INDEX "crm_lead_assignments_lock_idx" ON "crm_lead_assignments"("ownership_locked_until");

-- CreateIndex
CREATE UNIQUE INDEX "crm_lead_assignments_lead_active_status_key"
ON "crm_lead_assignments"("lead_id")
WHERE "assignment_status" IN ('pending_assignment', 'accepted', 'auto_accepted');

-- CreateIndex
CREATE INDEX "crm_assignment_events_scope_created_idx" ON "crm_assignment_events"("workspace_id", "team_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_assignment_events_lead_created_idx" ON "crm_assignment_events"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_assignment_events_type_created_idx" ON "crm_assignment_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "crm_outreach_queue_scope_status_schedule_idx" ON "crm_outreach_queue"("workspace_id", "team_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "crm_outreach_queue_sponsor_status_created_idx" ON "crm_outreach_queue"("sponsor_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "crm_outreach_queue_lead_intent_status_idx" ON "crm_outreach_queue"("lead_id", "intent_type", "status");

-- AddForeignKey
ALTER TABLE "crm_lead_assignments" ADD CONSTRAINT "crm_lead_assignments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignments" ADD CONSTRAINT "crm_lead_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignments" ADD CONSTRAINT "crm_lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignments" ADD CONSTRAINT "crm_lead_assignments_attributed_sponsor_id_fkey" FOREIGN KEY ("attributed_sponsor_id") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignments" ADD CONSTRAINT "crm_lead_assignments_assigned_sponsor_id_fkey" FOREIGN KEY ("assigned_sponsor_id") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignments" ADD CONSTRAINT "crm_lead_assignments_accepted_by_sponsor_id_fkey" FOREIGN KEY ("accepted_by_sponsor_id") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_assignments" ADD CONSTRAINT "crm_lead_assignments_conversation_owner_sponsor_id_fkey" FOREIGN KEY ("conversation_owner_sponsor_id") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_assignment_events" ADD CONSTRAINT "crm_assignment_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_assignment_events" ADD CONSTRAINT "crm_assignment_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_assignment_events" ADD CONSTRAINT "crm_assignment_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_assignment_events" ADD CONSTRAINT "crm_assignment_events_actor_sponsor_id_fkey" FOREIGN KEY ("actor_sponsor_id") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_outreach_queue" ADD CONSTRAINT "crm_outreach_queue_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_outreach_queue" ADD CONSTRAINT "crm_outreach_queue_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_outreach_queue" ADD CONSTRAINT "crm_outreach_queue_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_outreach_queue" ADD CONSTRAINT "crm_outreach_queue_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
