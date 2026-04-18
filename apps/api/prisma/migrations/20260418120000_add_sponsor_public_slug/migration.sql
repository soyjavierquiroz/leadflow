ALTER TABLE "Sponsor"
ADD COLUMN "publicSlug" TEXT;

CREATE UNIQUE INDEX "Sponsor_publicSlug_key" ON "Sponsor"("publicSlug");
