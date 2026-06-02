-- Persist only the current vanity shortlink for each sponsor.
CREATE TABLE "SponsorVanityShortLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "shortUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorVanityShortLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SponsorVanityShortLink_sponsorId_key"
ON "SponsorVanityShortLink"("sponsorId");

CREATE UNIQUE INDEX "SponsorVanityShortLink_shortCode_key"
ON "SponsorVanityShortLink"("shortCode");

CREATE INDEX "SponsorVanityShortLink_workspaceId_teamId_idx"
ON "SponsorVanityShortLink"("workspaceId", "teamId");

CREATE INDEX "SponsorVanityShortLink_teamId_shortCode_idx"
ON "SponsorVanityShortLink"("teamId", "shortCode");

ALTER TABLE "SponsorVanityShortLink"
ADD CONSTRAINT "SponsorVanityShortLink_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SponsorVanityShortLink"
ADD CONSTRAINT "SponsorVanityShortLink_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SponsorVanityShortLink"
ADD CONSTRAINT "SponsorVanityShortLink_sponsorId_fkey"
FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
