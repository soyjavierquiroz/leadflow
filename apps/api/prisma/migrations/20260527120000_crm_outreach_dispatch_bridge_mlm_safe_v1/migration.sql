-- Extend CRM outreach lifecycle for controlled external handoff.
ALTER TYPE "CrmOutreachStatus" ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE "CrmOutreachStatus" ADD VALUE IF NOT EXISTS 'handed_off';

-- Retry and failure state for auditable dry-run/controlled dispatch bridge.
ALTER TABLE "crm_outreach_queue"
  ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_attempt_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failure_reason" JSONB;

CREATE INDEX IF NOT EXISTS "crm_outreach_queue_scope_status_retry_idx"
  ON "crm_outreach_queue"("workspace_id", "team_id", "status", "next_retry_at");
