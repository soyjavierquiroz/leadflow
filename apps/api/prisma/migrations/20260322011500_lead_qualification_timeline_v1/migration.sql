CREATE TYPE "LeadQualificationGrade" AS ENUM ('cold', 'warm', 'hot');

ALTER TABLE "Lead"
ADD COLUMN "qualificationGrade" "LeadQualificationGrade",
ADD COLUMN "summaryText" TEXT,
ADD COLUMN "nextActionLabel" TEXT,
ADD COLUMN "followUpAt" TIMESTAMP(3),
ADD COLUMN "lastContactedAt" TIMESTAMP(3),
ADD COLUMN "lastQualifiedAt" TIMESTAMP(3);

CREATE TABLE "LeadNote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sponsorId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "authorRole" "UserRole" NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");
CREATE INDEX "LeadNote_workspaceId_createdAt_idx" ON "LeadNote"("workspaceId", "createdAt");
CREATE INDEX "LeadNote_teamId_createdAt_idx" ON "LeadNote"("teamId", "createdAt");
CREATE INDEX "LeadNote_authorUserId_createdAt_idx" ON "LeadNote"("authorUserId", "createdAt");

ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
