ALTER TABLE "Assignment"
ADD COLUMN "ownershipKey" TEXT;

CREATE UNIQUE INDEX "Assignment_ownershipKey_key" ON "Assignment"("ownershipKey");
