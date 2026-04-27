-- Convert ad wheels from finite seat inventory to an infinite weighted cycle.
ALTER TABLE "AdWheel"
ADD COLUMN IF NOT EXISTS "currentTurnPosition" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "sequenceVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "AdWheelTurn"
ADD COLUMN IF NOT EXISTS "sequenceVersion" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "AdWheelTurn_adWheelId_position_key";
DROP INDEX IF EXISTS "AdWheelTurn_adWheelId_isConsumed_position_idx";
DROP INDEX IF EXISTS "AdWheelTurn_sponsorId_isConsumed_idx";

ALTER TABLE "AdWheelTurn"
DROP COLUMN IF EXISTS "isConsumed",
DROP COLUMN IF EXISTS "assignmentId";

CREATE UNIQUE INDEX IF NOT EXISTS "AdWheelTurn_adWheelId_sequenceVersion_position_key"
ON "AdWheelTurn"("adWheelId", "sequenceVersion", "position");

CREATE INDEX IF NOT EXISTS "AdWheelTurn_adWheelId_sequenceVersion_position_idx"
ON "AdWheelTurn"("adWheelId", "sequenceVersion", "position");

CREATE INDEX IF NOT EXISTS "AdWheelTurn_sponsorId_sequenceVersion_idx"
ON "AdWheelTurn"("sponsorId", "sequenceVersion");

UPDATE "AdWheel"
SET "currentTurnPosition" = 1
WHERE "currentTurnPosition" < 1;
