-- Persist Kloser mission handoff state without changing MLM ownership data.
ALTER TABLE "crm_outreach_queue"
  ADD COLUMN IF NOT EXISTS "external_mission_id" TEXT,
  ADD COLUMN IF NOT EXISTS "external_handoff_status" TEXT,
  ADD COLUMN IF NOT EXISTS "last_handoff_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_handoff_error" JSONB;

CREATE INDEX IF NOT EXISTS "crm_outreach_queue_scope_external_status_idx"
  ON "crm_outreach_queue"("workspace_id", "team_id", "external_handoff_status");

CREATE INDEX IF NOT EXISTS "crm_outreach_queue_external_mission_idx"
  ON "crm_outreach_queue"("external_mission_id");
