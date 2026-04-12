CREATE TABLE "FunnelStepHistory" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "blocksJson" JSONB NOT NULL,
    "settingsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "FunnelStepHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FunnelStepHistory_stepId_createdAt_idx"
ON "FunnelStepHistory"("stepId", "createdAt");

ALTER TABLE "FunnelStepHistory"
ADD CONSTRAINT "FunnelStepHistory_stepId_fkey"
FOREIGN KEY ("stepId") REFERENCES "FunnelStep"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
