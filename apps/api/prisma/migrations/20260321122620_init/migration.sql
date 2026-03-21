-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "SponsorStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('available', 'paused', 'offline');

-- CreateEnum
CREATE TYPE "RotationStrategy" AS ENUM ('round_robin', 'weighted', 'manual');

-- CreateEnum
CREATE TYPE "RotationPoolStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "FunnelStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "LeadSourceChannel" AS ENUM ('manual', 'form', 'landing_page', 'api', 'import', 'automation');

-- CreateEnum
CREATE TYPE "VisitorKind" AS ENUM ('anonymous', 'identified');

-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('active', 'converted', 'archived');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('captured', 'qualified', 'assigned', 'nurturing', 'won', 'lost');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('pending', 'assigned', 'accepted', 'reassigned', 'closed');

-- CreateEnum
CREATE TYPE "AssignmentReason" AS ENUM ('rotation', 'manual', 'fallback', 'handoff');

-- CreateEnum
CREATE TYPE "EventActorType" AS ENUM ('system', 'user', 'visitor', 'integration');

-- CreateEnum
CREATE TYPE "EventAggregateType" AS ENUM ('workspace', 'team', 'sponsor', 'rotation_pool', 'rotation_member', 'funnel', 'visitor', 'lead', 'assignment', 'event');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "WorkspaceStatus" NOT NULL,
    "timezone" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL,
    "primaryLocale" TEXT NOT NULL,
    "primaryDomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "TeamStatus" NOT NULL,
    "description" TEXT,
    "managerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "SponsorStatus" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "availabilityStatus" "AvailabilityStatus" NOT NULL,
    "routingWeight" INTEGER NOT NULL,
    "memberPortalEnabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funnel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "FunnelStatus" NOT NULL,
    "stages" TEXT[],
    "entrySources" "LeadSourceChannel"[],
    "defaultTeamId" TEXT,
    "defaultRotationPoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationPool" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RotationPoolStatus" NOT NULL,
    "strategy" "RotationStrategy" NOT NULL,
    "isFallbackPool" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotationPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationMember" (
    "id" TEXT NOT NULL,
    "rotationPoolId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "kind" "VisitorKind" NOT NULL,
    "status" "VisitorStatus" NOT NULL,
    "sourceChannel" "LeadSourceChannel" NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "visitorId" TEXT,
    "sourceChannel" "LeadSourceChannel" NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "status" "LeadStatus" NOT NULL,
    "currentAssignmentId" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "rotationPoolId" TEXT,
    "status" "AssignmentStatus" NOT NULL,
    "reason" "AssignmentReason" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "aggregateType" "EventAggregateType" NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "actorType" "EventActorType" NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "visitorId" TEXT,
    "leadId" TEXT,
    "assignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Team_workspaceId_code_key" ON "Team"("workspaceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Funnel_workspaceId_code_key" ON "Funnel"("workspaceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RotationPool_workspaceId_name_key" ON "RotationPool"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RotationMember_rotationPoolId_sponsorId_key" ON "RotationMember"("rotationPoolId", "sponsorId");

-- CreateIndex
CREATE UNIQUE INDEX "RotationMember_rotationPoolId_position_key" ON "RotationMember"("rotationPoolId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_workspaceId_anonymousId_key" ON "Visitor"("workspaceId", "anonymousId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_visitorId_key" ON "Lead"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_currentAssignmentId_key" ON "Lead"("currentAssignmentId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_defaultTeamId_fkey" FOREIGN KEY ("defaultTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_defaultRotationPoolId_fkey" FOREIGN KEY ("defaultRotationPoolId") REFERENCES "RotationPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationPool" ADD CONSTRAINT "RotationPool_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationPool" ADD CONSTRAINT "RotationPool_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationMember" ADD CONSTRAINT "RotationMember_rotationPoolId_fkey" FOREIGN KEY ("rotationPoolId") REFERENCES "RotationPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationMember" ADD CONSTRAINT "RotationMember_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_currentAssignmentId_fkey" FOREIGN KEY ("currentAssignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_rotationPoolId_fkey" FOREIGN KEY ("rotationPoolId") REFERENCES "RotationPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
