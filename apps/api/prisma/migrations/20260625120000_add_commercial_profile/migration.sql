CREATE TABLE "CommercialProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sponsorId" TEXT,
    "vertical" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "businessModel" TEXT NOT NULL,
    "legacyNiche" TEXT,
    "presetVersion" TEXT NOT NULL,
    "blueprintKey" TEXT NOT NULL,
    "blueprintVersion" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "mainProduct" TEXT,
    "averagePrice" TEXT,
    "salesMotion" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercialProfile_teamId_key"
ON "CommercialProfile"("teamId");

CREATE INDEX "CommercialProfile_workspaceId_idx"
ON "CommercialProfile"("workspaceId");

CREATE INDEX "CommercialProfile_sponsorId_idx"
ON "CommercialProfile"("sponsorId");

ALTER TABLE "CommercialProfile"
ADD CONSTRAINT "CommercialProfile_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommercialProfile"
ADD CONSTRAINT "CommercialProfile_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommercialProfile"
ADD CONSTRAINT "CommercialProfile_sponsorId_fkey"
FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
