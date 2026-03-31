ALTER TABLE "Assignment"
ADD COLUMN "acceptedAt" TIMESTAMP(3);

UPDATE "Assignment"
SET "acceptedAt" = "updatedAt"
WHERE "status" = 'accepted'
  AND "acceptedAt" IS NULL;
