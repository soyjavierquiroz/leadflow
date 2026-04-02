import { Prisma } from '@prisma/client';
import type { Assignment } from '../modules/assignments/interfaces/assignment.interface';
import type { ConversionEventMapping } from '../modules/conversion-event-mappings/interfaces/conversion-event-mapping.interface';
import type { DomainEntity } from '../modules/domains/interfaces/domain.interface';
import type { DomainEvent } from '../modules/events/interfaces/event.interface';
import type { FunnelInstance } from '../modules/funnel-instances/interfaces/funnel-instance.interface';
import type { FunnelPublication } from '../modules/funnel-publications/interfaces/funnel-publication.interface';
import type { FunnelStep } from '../modules/funnel-steps/interfaces/funnel-step.interface';
import type { FunnelTemplate } from '../modules/funnel-templates/interfaces/funnel-template.interface';
import type { Funnel } from '../modules/funnels/interfaces/funnel.interface';
import type { HandoffStrategy } from '../modules/handoff-strategies/interfaces/handoff-strategy.interface';
import type { Lead } from '../modules/leads/interfaces/lead.interface';
import type { RotationPool } from '../modules/rotation-pools/interfaces/rotation-pool.interface';
import type { Sponsor } from '../modules/sponsors/interfaces/sponsor.interface';
import type { Team } from '../modules/teams/interfaces/team.interface';
import type { TrackingProfile } from '../modules/tracking-profiles/interfaces/tracking-profile.interface';
import type { Visitor } from '../modules/visitors/interfaces/visitor.interface';
import type { Workspace } from '../modules/workspaces/interfaces/workspace.interface';
import type { JsonValue } from '../modules/shared/domain.types';

const toIso = (value: Date) => value.toISOString();
const toJson = (value: unknown): JsonValue => value as JsonValue;

export const teamInclude = {
  sponsors: { select: { id: true } },
  funnels: { select: { id: true } },
  domains: { select: { id: true } },
  funnelInstances: { select: { id: true } },
  funnelPublications: { select: { id: true } },
  trackingProfiles: { select: { id: true } },
  handoffStrategies: { select: { id: true } },
  rotationPools: { select: { id: true } },
} satisfies Prisma.TeamInclude;

export const rotationPoolInclude = {
  members: { select: { sponsorId: true }, orderBy: { position: 'asc' } },
  defaultFunnels: { select: { id: true } },
} satisfies Prisma.RotationPoolInclude;

export const visitorInclude = {
  lead: { select: { id: true } },
} satisfies Prisma.VisitorInclude;

export const funnelInstanceInclude = {
  steps: { select: { id: true }, orderBy: { position: 'asc' } },
  publications: { select: { id: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.FunnelInstanceInclude;

export const trackingProfileInclude = {
  conversionEventMappings: {
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.TrackingProfileInclude;

export type WorkspaceRecord = Prisma.WorkspaceGetPayload<Record<string, never>>;
export type TeamRecord = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;
export type SponsorRecord = Prisma.SponsorGetPayload<Record<string, never>>;
export type FunnelRecord = Prisma.FunnelGetPayload<Record<string, never>>;
export type DomainRecord = Prisma.DomainGetPayload<Record<string, never>>;
export type FunnelTemplateRecord = Prisma.FunnelTemplateGetPayload<
  Record<string, never>
>;
export type FunnelInstanceRecord = Prisma.FunnelInstanceGetPayload<{
  include: typeof funnelInstanceInclude;
}>;
export type FunnelStepRecord = Prisma.FunnelStepGetPayload<
  Record<string, never>
>;
export type FunnelPublicationRecord = Prisma.FunnelPublicationGetPayload<
  Record<string, never>
>;
export type TrackingProfileRecord = Prisma.TrackingProfileGetPayload<{
  include: typeof trackingProfileInclude;
}>;
export type ConversionEventMappingRecord =
  Prisma.ConversionEventMappingGetPayload<Record<string, never>>;
export type HandoffStrategyRecord = Prisma.HandoffStrategyGetPayload<
  Record<string, never>
>;
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
  isActive: record.isActive,
  subscriptionExpiresAt: record.subscriptionExpiresAt
    ? toIso(record.subscriptionExpiresAt)
    : null,
  description: record.description,
  managerUserId: record.managerUserId,
  maxSeats: record.maxSeats,
  sponsorIds: record.sponsors.map((item) => item.id),
  funnelIds: record.funnels.map((item) => item.id),
  domainIds: record.domains.map((item) => item.id),
  funnelInstanceIds: record.funnelInstances.map((item) => item.id),
  funnelPublicationIds: record.funnelPublications.map((item) => item.id),
  trackingProfileIds: record.trackingProfiles.map((item) => item.id),
  handoffStrategyIds: record.handoffStrategies.map((item) => item.id),
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
  isActive: record.isActive,
  avatarUrl: record.avatarUrl,
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
  description: record.description,
  code: record.code,
  thumbnailUrl: record.thumbnailUrl,
  config: toJson(record.config),
  status: record.status,
  isTemplate: record.isTemplate,
  stages: record.stages,
  entrySources: record.entrySources.map((item) =>
    item === 'landing_page' ? 'landing-page' : item,
  ),
  defaultTeamId: record.defaultTeamId,
  defaultRotationPoolId: record.defaultRotationPoolId,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapDomainRecord = (record: DomainRecord): DomainEntity => ({
  id: record.id,
  workspaceId: record.workspaceId,
  teamId: record.teamId,
  linkedFunnelId: record.linkedFunnelId,
  host: record.host,
  normalizedHost: record.normalizedHost,
  status: record.status,
  onboardingStatus: record.onboardingStatus,
  domainType: record.domainType,
  isPrimary: record.isPrimary,
  canonicalHost: record.canonicalHost,
  redirectToPrimary: record.redirectToPrimary,
  verificationStatus: record.verificationStatus,
  sslStatus: record.sslStatus,
  verificationMethod: record.verificationMethod,
  cloudflareCustomHostnameId: record.cloudflareCustomHostnameId,
  cloudflareStatusJson: record.cloudflareStatusJson
    ? toJson(record.cloudflareStatusJson)
    : null,
  dnsTarget: record.dnsTarget,
  lastCloudflareSyncAt: record.lastCloudflareSyncAt
    ? toIso(record.lastCloudflareSyncAt)
    : null,
  activatedAt: record.activatedAt ? toIso(record.activatedAt) : null,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapFunnelTemplateRecord = (
  record: FunnelTemplateRecord,
): FunnelTemplate => ({
  id: record.id,
  workspaceId: record.workspaceId,
  name: record.name,
  code: record.code,
  status: record.status,
  version: record.version,
  funnelType: record.funnelType,
  blocksJson: toJson(record.blocksJson),
  mediaMap: toJson(record.mediaMap),
  settingsJson: toJson(record.settingsJson),
  allowedOverridesJson: toJson(record.allowedOverridesJson),
  defaultHandoffStrategyId: record.defaultHandoffStrategyId,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapFunnelInstanceRecord = (
  record: FunnelInstanceRecord,
): FunnelInstance => ({
  id: record.id,
  workspaceId: record.workspaceId,
  teamId: record.teamId,
  templateId: record.templateId,
  legacyFunnelId: record.legacyFunnelId,
  name: record.name,
  code: record.code,
  thumbnailUrl: record.thumbnailUrl,
  status: record.status,
  rotationPoolId: record.rotationPoolId,
  trackingProfileId: record.trackingProfileId,
  handoffStrategyId: record.handoffStrategyId,
  settingsJson: toJson(record.settingsJson),
  mediaMap: toJson(record.mediaMap),
  stepIds: record.steps.map((item) => item.id),
  publicationIds: record.publications.map((item) => item.id),
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapFunnelStepRecord = (record: FunnelStepRecord): FunnelStep => ({
  id: record.id,
  workspaceId: record.workspaceId,
  teamId: record.teamId,
  funnelInstanceId: record.funnelInstanceId,
  stepType: record.stepType,
  slug: record.slug,
  position: record.position,
  isEntryStep: record.isEntryStep,
  isConversionStep: record.isConversionStep,
  blocksJson: toJson(record.blocksJson),
  mediaMap: toJson(record.mediaMap),
  settingsJson: toJson(record.settingsJson),
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapFunnelPublicationRecord = (
  record: FunnelPublicationRecord,
): FunnelPublication => ({
  id: record.id,
  workspaceId: record.workspaceId,
  teamId: record.teamId,
  domainId: record.domainId,
  funnelInstanceId: record.funnelInstanceId,
  trackingProfileId: record.trackingProfileId,
  handoffStrategyId: record.handoffStrategyId,
  pathPrefix: record.pathPrefix,
  status: record.status,
  isActive: record.isActive,
  isPrimary: record.isPrimary,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapTrackingProfileRecord = (
  record: TrackingProfileRecord,
): TrackingProfile => ({
  id: record.id,
  workspaceId: record.workspaceId,
  teamId: record.teamId,
  name: record.name,
  provider: record.provider,
  status: record.status,
  configJson: toJson(record.configJson),
  deduplicationMode: record.deduplicationMode,
  conversionEventMappingIds: record.conversionEventMappings.map(
    (item) => item.id,
  ),
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapConversionEventMappingRecord = (
  record: ConversionEventMappingRecord,
): ConversionEventMapping => ({
  id: record.id,
  trackingProfileId: record.trackingProfileId,
  internalEventName: record.internalEventName,
  providerEventName: record.providerEventName,
  isBrowserSide: record.isBrowserSide,
  isServerSide: record.isServerSide,
  isCriticalConversion: record.isCriticalConversion,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapHandoffStrategyRecord = (
  record: HandoffStrategyRecord,
): HandoffStrategy => ({
  id: record.id,
  workspaceId: record.workspaceId,
  teamId: record.teamId,
  name: record.name,
  type: record.type,
  status: record.status,
  settingsJson: toJson(record.settingsJson),
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
  funnelInstanceId: record.funnelInstanceId,
  funnelPublicationId: record.funnelPublicationId,
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
  qualificationGrade: record.qualificationGrade,
  summaryText: record.summaryText,
  nextActionLabel: record.nextActionLabel,
  followUpAt: record.followUpAt ? toIso(record.followUpAt) : null,
  lastContactedAt: record.lastContactedAt
    ? toIso(record.lastContactedAt)
    : null,
  lastQualifiedAt: record.lastQualifiedAt
    ? toIso(record.lastQualifiedAt)
    : null,
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
  funnelInstanceId: record.funnelInstanceId,
  funnelPublicationId: record.funnelPublicationId,
  rotationPoolId: record.rotationPoolId,
  status: record.status,
  reason: record.reason,
  assignedAt: toIso(record.assignedAt),
  acceptedAt: record.acceptedAt ? toIso(record.acceptedAt) : null,
  resolvedAt: record.resolvedAt ? toIso(record.resolvedAt) : null,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});

export const mapDomainEventRecord = (
  record: DomainEventRecord,
): DomainEvent => ({
  id: record.id,
  workspaceId: record.workspaceId,
  eventId: record.eventId,
  aggregateType:
    record.aggregateType === 'rotation_pool'
      ? 'rotation-pool'
      : record.aggregateType === 'rotation_member'
        ? 'rotation-member'
        : record.aggregateType === 'funnel_template'
          ? 'funnel-template'
          : record.aggregateType === 'funnel_instance'
            ? 'funnel-instance'
            : record.aggregateType === 'funnel_step'
              ? 'funnel-step'
              : record.aggregateType === 'funnel_publication'
                ? 'funnel-publication'
                : record.aggregateType === 'tracking_profile'
                  ? 'tracking-profile'
                  : record.aggregateType === 'conversion_event_mapping'
                    ? 'conversion-event-mapping'
                    : record.aggregateType === 'handoff_strategy'
                      ? 'handoff-strategy'
                      : record.aggregateType,
  aggregateId: record.aggregateId,
  eventName: record.eventName,
  actorType: record.actorType,
  payload:
    typeof record.payload === 'object' && record.payload !== null
      ? (record.payload as Record<string, unknown>)
      : {},
  occurredAt: toIso(record.occurredAt),
  funnelInstanceId: record.funnelInstanceId,
  funnelPublicationId: record.funnelPublicationId,
  funnelStepId: record.funnelStepId,
  visitorId: record.visitorId,
  leadId: record.leadId,
  assignmentId: record.assignmentId,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
});
