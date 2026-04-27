-- Link ad wheels to the publication/funnel they are allowed to serve.
ALTER TABLE "AdWheel"
ADD COLUMN "publicationId" TEXT;

ALTER TABLE "AdWheel"
ADD CONSTRAINT "AdWheel_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "FunnelPublication"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdWheel_teamId_publicationId_status_idx"
ON "AdWheel"("teamId", "publicationId", "status");
