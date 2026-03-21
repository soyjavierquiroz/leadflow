import { Prisma } from '@prisma/client';
import type { Assignment } from '../modules/assignments/interfaces/assignment.interface';
import type { DomainEvent } from '../modules/events/interfaces/event.interface';
import type { Funnel } from '../modules/funnels/interfaces/funnel.interface';
import type { Lead } from '../modules/leads/interfaces/lead.interface';
import type { RotationPool } from '../modules/rotation-pools/interfaces/rotation-pool.interface';
import type { Sponsor } from '../modules/sponsors/interfaces/sponsor.interface';
import type { Team } from '../modules/teams/interfaces/team.interface';
import type { Visitor } from '../modules/visitors/interfaces/visitor.interface';
import type { Workspace } from '../modules/workspaces/interfaces/workspace.interface';

const toIso = (value: Date) => value.toISOString();

export const teamInclude = {
  sponsors: { select: { id: true } },
  funnels: { select: { id: true } },
  rotationPools: { select: { id: true } },
} satisfies Prisma.TeamInclude;

export const rotationPoolInclude = {
  members: { select: { sponsorId: true }, orderBy: { position: 'asc' } },
  defaultFunnels: { select: { id: true } },
} satisfies Prisma.RotationPoolInclude;

export const visitorInclude = {
  lead: { select: { id: true } },
} satisfies Prisma.VisitorInclude;

export type WorkspaceRecord = Prisma.WorkspaceGetPayload<Record<string, never>>;
export type TeamRecord = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;
export type SponsorRecord = Prisma.SponsorGetPayload<Record<string, never>>;
export type FunnelRecord = Prisma.FunnelGetPayload<Record<string, never>>;
export type RotationPoolRecord = Prisma.RotationPoolGetPayload<{
  include: typeof rotationPoolInclude;
}>;
export type VisitorRecord = Prisma.VisitorGetPayload<{
  include: typeof visitorInclude;
}>;
export type LeadRecord = Prisma.LeadGetPayload<Record<string, never>>;
export type AssignmentRecord = Prisma.AssignmentGetPayload<
  Record<string, never>
>;
export type DomainEventRecord = Prisma.DomainEventGetPayload<
  Record<string, never>
>;

export const mapWorkspaceRecord = (record: WorkspaceRecord): Workspace => ({
  id: record.id,
  name: record.name,
  slug: record.slug,
  status: record.status,
  timezone: record.timezone,
  defaultCurrency: record.defaultCurrency,
  primaryLocale: record.primaryLocale,
  primaryDomain: record.primaryDomain,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapTeamRecord = (record: TeamRecord): Team => ({
  id: record.id,
  workspaceId: record.workspaceId,
  name: record.name,
  code: record.code,
  status: record.status,
  description: record.description,
  managerUserId: record.managerUserId,
  sponsorIds: record.sponsors.map((item) => item.id),
  funnelIds: record.funnels.map((item) => item.id),
  rotationPoolIds: record.rotationPools.map((item) => item.id),
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapSponsorRecord = (record: SponsorRecord): Sponsor => ({
  id: record.id,
  workspaceId: record.workspaceId,
  teamId: record.teamId,
  displayName: record.displayName,
  status: record.status,
  email: record.email,
  phone: record.phone,
  availabilityStatus: record.availabilityStatus,
  routingWeight: record.routingWeight,
  memberPortalEnabled: record.memberPortalEnabled,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapFunnelRecord = (record: FunnelRecord): Funnel => ({
  id: record.id,
  workspaceId: record.workspaceId,
  name: record.name,
  code: record.code,
  status: record.status,
  stages: record.stages,
  entrySources: record.entrySources.map((item) =>
    item === 'landing_page' ? 'landing-page' : item,
  ),
  defaultTeamId: record.defaultTeamId,
  defaultRotationPoolId: record.defaultRotationPoolId,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapRotationPoolRecord = (
  record: RotationPoolRecord,
): RotationPool => ({
  id: record.id,
  workspaceId: record.workspaceId,
  teamId: record.teamId,
  name: record.name,
  status: record.status,
  strategy: record.strategy === 'round_robin' ? 'round-robin' : record.strategy,
  sponsorIds: record.members.map((item) => item.sponsorId),
  funnelIds: record.defaultFunnels.map((item) => item.id),
  isFallbackPool: record.isFallbackPool,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapVisitorRecord = (record: VisitorRecord): Visitor => ({
  id: record.id,
  workspaceId: record.workspaceId,
  anonymousId: record.anonymousId,
  kind: record.kind,
  status: record.status,
  sourceChannel:
    record.sourceChannel === 'landing_page'
      ? 'landing-page'
      : record.sourceChannel,
  leadId: record.lead?.id ?? null,
  firstSeenAt: toIso(record.firstSeenAt),
  lastSeenAt: toIso(record.lastSeenAt),
  utmSource: record.utmSource,
  utmCampaign: record.utmCampaign,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapLeadRecord = (record: LeadRecord): Lead => ({
  id: record.id,
  workspaceId: record.workspaceId,
  funnelId: record.funnelId,
  visitorId: record.visitorId,
  sourceChannel:
    record.sourceChannel === 'landing_page'
      ? 'landing-page'
      : record.sourceChannel,
  fullName: record.fullName,
  email: record.email,
  phone: record.phone,
  companyName: record.companyName,
  status: record.status,
  currentAssignmentId: record.currentAssignmentId,
  tags: record.tags,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapAssignmentRecord = (record: AssignmentRecord): Assignment => ({
  id: record.id,
  workspaceId: record.workspaceId,
  leadId: record.leadId,
  sponsorId: record.sponsorId,
  teamId: record.teamId,
  funnelId: record.funnelId,
  rotationPoolId: record.rotationPoolId,
  status: record.status,
  reason: record.reason,
  assignedAt: toIso(record.assignedAt),
  resolvedAt: record.resolvedAt ? toIso(record.resolvedAt) : null,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapDomainEventRecord = (
  record: DomainEventRecord,
): DomainEvent => ({
  id: record.id,
  workspaceId: record.workspaceId,
  aggregateType:
    record.aggregateType === 'rotation_pool'
      ? 'rotation-pool'
      : record.aggregateType === 'rotation_member'
        ? 'rotation-member'
        : record.aggregateType,
  aggregateId: record.aggregateId,
  eventName: record.eventName,
  actorType: record.actorType,
  payload:
    typeof record.payload === 'object' && record.payload !== null
      ? (record.payload as Record<string, unknown>)
      : {},
  occurredAt: toIso(record.occurredAt),
  visitorId: record.visitorId,
  leadId: record.leadId,
  assignmentId: record.assignmentId,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});
