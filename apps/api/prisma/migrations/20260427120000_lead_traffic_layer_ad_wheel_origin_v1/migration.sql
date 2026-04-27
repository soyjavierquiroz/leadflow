-- Align traffic attribution and ad wheel turn persistence with the Prisma schema.
ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "trafficLayer" TEXT,
ADD COLUMN IF NOT EXISTS "originAdWheelId" TEXT;

ALTER TABLE "Assignment"
ADD COLUMN IF NOT EXISTS "trafficLayer" TEXT,
ADD COLUMN IF NOT EXISTS "originAdWheelId" TEXT;

ALTER TABLE "AdWheelParticipant"
ADD COLUMN IF NOT EXISTS "seatCount" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "AdWheelTurn" (
    "id" TEXT NOT NULL,
    "adWheelId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "assignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdWheelTurn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdWheelTurn_adWheelId_position_key" ON "AdWheelTurn"("adWheelId", "position");
CREATE INDEX IF NOT EXISTS "AdWheelTurn_adWheelId_isConsumed_position_idx" ON "AdWheelTurn"("adWheelId", "isConsumed", "position");
CREATE INDEX IF NOT EXISTS "AdWheelTurn_sponsorId_isConsumed_idx" ON "AdWheelTurn"("sponsorId", "isConsumed");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lead_originAdWheelId_fkey'
  ) THEN
    ALTER TABLE "Lead"
    ADD CONSTRAINT "Lead_originAdWheelId_fkey"
    FOREIGN KEY ("originAdWheelId") REFERENCES "AdWheel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Assignment_originAdWheelId_fkey'
  ) THEN
    ALTER TABLE "Assignment"
    ADD CONSTRAINT "Assignment_originAdWheelId_fkey"
    FOREIGN KEY ("originAdWheelId") REFERENCES "AdWheel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdWheelTurn_adWheelId_fkey'
  ) THEN
    ALTER TABLE "AdWheelTurn"
    ADD CONSTRAINT "AdWheelTurn_adWheelId_fkey"
    FOREIGN KEY ("adWheelId") REFERENCES "AdWheel"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdWheelTurn_sponsorId_fkey'
  ) THEN
    ALTER TABLE "AdWheelTurn"
    ADD CONSTRAINT "AdWheelTurn_sponsorId_fkey"
    FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
