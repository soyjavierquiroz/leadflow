import type { AuthenticatedAppUser } from "@/lib/auth";

export type CollectionSource = "live" | "mock";
export type DataSourceMode = "live" | "mock" | "hybrid";

export type AuthenticatedAppUserRecord = AuthenticatedAppUser;

export type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  defaultCurrency: string;
  primaryLocale: string;
  primaryDomain: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamMetadata = {
  id: string;
  workspaceId: string;
  name: string;
  code: string;
  status: string;
  description: string | null;
};

export type FunnelTemplateRecord = {
  id: string;
  workspaceId: string | null;
  name: string;
  code: string;
  status: string;
  version: number;
  funnelType: string;
  blocksJson: unknown;
  mediaMap: unknown;
  settingsJson: unknown;
  allowedOverridesJson: unknown;
  defaultHandoffStrategyId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FunnelInstanceRecord = {
  id: string;
  workspaceId: string;
  teamId: string;
  templateId: string;
  legacyFunnelId: string | null;
  name: string;
  code: string;
  status: string;
  rotationPoolId: string | null;
  trackingProfileId: string | null;
  handoffStrategyId: string | null;
  settingsJson: unknown;
  mediaMap: unknown;
  stepIds: string[];
  publicationIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type FunnelPublicationRecord = {
  id: string;
  workspaceId: string;
  teamId: string;
  domainId: string;
  funnelInstanceId: string;
  trackingProfileId: string | null;
  handoffStrategyId: string | null;
  pathPrefix: string;
  status: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DomainRecord = {
  id: string;
  workspaceId: string;
  teamId: string;
  host: string;
  requestedHostname: string;
  normalizedHost: string;
  status: string;
  onboardingStatus: string;
  domainType: string;
  isPrimary: boolean;
  canonicalHost: string | null;
  redirectToPrimary: boolean;
  verificationStatus: string;
  sslStatus: string;
  verificationMethod: string;
  cloudflareCustomHostnameId: string | null;
  cloudflareStatusJson: unknown;
  cnameTarget: string | null;
  fallbackOrigin: string | null;
  cloudflareHostnameStatus: string | null;
  cloudflareSslStatus: string | null;
  cloudflareErrorMessage: string | null;
  operationalStatus: string;
  isLegacyConfiguration: boolean;
  recreateRequired: boolean;
  legacyReason: string | null;
  dnsTarget: string | null;
  lastCloudflareSyncAt: string | null;
  activatedAt: string | null;
  dnsInstructions?: Array<{
    id: string;
    type: string;
    host: string | null;
    value: string;
    status: string;
    label: string;
    detail: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type SponsorRecord = {
  id: string;
  workspaceId: string;
  teamId: string;
  displayName: string;
  status: string;
  email: string | null;
  phone: string | null;
  availabilityStatus: string;
  routingWeight: number;
  memberPortalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RotationPoolRecord = {
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  status: string;
  strategy: string;
  sponsorIds: string[];
  funnelIds: string[];
  isFallbackPool: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RotationPoolMemberRecord = {
  id: string;
  rotationPoolId: string;
  poolName: string;
  sponsorId: string;
  sponsorName: string;
  sponsorStatus: string;
  sponsorAvailabilityStatus: string;
  position: number;
  weight: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeadRecord = {
  id: string;
  workspaceId: string;
  funnelId: string;
  funnelInstanceId: string | null;
  funnelPublicationId: string | null;
  visitorId: string | null;
  sourceChannel: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  status: string;
  qualificationGrade: "cold" | "warm" | "hot" | null;
  summaryText: string | null;
  nextActionLabel: string | null;
  followUpAt: string | null;
  lastContactedAt: string | null;
  lastQualifiedAt: string | null;
  currentAssignmentId: string | null;
  reminderBucket: "overdue" | "due_today" | "upcoming" | "unscheduled" | "none";
  reminderLabel: string | null;
  suggestedNextAction: string | null;
  effectiveNextAction: string | null;
  playbookKey:
    | "first_contact"
    | "active_nurture"
    | "high_intent_close"
    | "cold_reengage"
    | "won_handoff"
    | "lost_recycle"
    | null;
  playbookTitle: string | null;
  playbookDescription: string | null;
  needsAttention: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type AssignmentRecord = {
  id: string;
  workspaceId: string;
  leadId: string;
  sponsorId: string;
  teamId: string;
  funnelId: string;
  funnelInstanceId: string | null;
  funnelPublicationId: string | null;
  rotationPoolId: string | null;
  status: string;
  reason: string;
  assignedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventRecord = {
  id: string;
  workspaceId: string;
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventName: string;
  actorType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  funnelInstanceId: string | null;
  funnelPublicationId: string | null;
  funnelStepId: string | null;
  visitorId: string | null;
  leadId: string | null;
  assignmentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TrackingProfileRecord = {
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  provider: string;
  status: string;
  configJson: unknown;
  deduplicationMode: string;
  conversionEventMappingIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type HandoffStrategyRecord = {
  id: string;
  workspaceId: string;
  teamId: string | null;
  name: string;
  type: string;
  status: string;
  settingsJson: unknown;
  createdAt: string;
  updatedAt: string;
};

export type DerivedTeam = TeamMetadata & {
  sponsorCount: number;
  funnelCount: number;
  publicationCount: number;
  domainCount: number;
  poolCount: number;
  leadCount: number;
  assignmentCount: number;
};

export type PublicationView = FunnelPublicationRecord & {
  domainHost: string;
  funnelName: string;
  funnelCode: string;
  templateName: string;
  isHybridVsl: boolean;
  teamName: string;
  trackingLabel: string;
  handoffLabel: string;
};

export type FunnelView = FunnelInstanceRecord & {
  templateName: string;
  publicationCount: number;
  teamName: string;
  rotationLabel: string;
  trackingReady: boolean;
};

export type LeadView = LeadRecord & {
  sponsorName: string | null;
  sponsorId: string | null;
  assignmentStatus: string | null;
  assignedAt: string | null;
  publicationPath: string | null;
  domainHost: string | null;
  funnelName: string | null;
  funnelCode: string | null;
  teamId: string | null;
  teamName: string | null;
};

export type LeadRemindersSummary = {
  generatedAt: string;
  totals: {
    active: number;
    overdue: number;
    dueToday: number;
    upcoming: number;
    unscheduled: number;
    needsAttention: number;
  };
};

export type MemberProfile = {
  title: string;
  focus: string;
  timezone: string;
  responseWindow: string;
  channels: string[];
  notes: string;
};

export type ShellNavItem = {
  href: string;
  label: string;
  description: string;
  match?: string;
};

export type AppShellSnapshot = {
  currentUser: AuthenticatedAppUserRecord | null;
  sourceMode: DataSourceMode;
  sources: Record<string, CollectionSource>;
  workspaces: WorkspaceRecord[];
  workspace: WorkspaceRecord;
  teams: DerivedTeam[];
  currentTeam: DerivedTeam;
  templates: FunnelTemplateRecord[];
  funnelInstances: FunnelInstanceRecord[];
  funnelViews: FunnelView[];
  publications: FunnelPublicationRecord[];
  publicationViews: PublicationView[];
  domains: DomainRecord[];
  sponsors: SponsorRecord[];
  currentSponsor: SponsorRecord;
  rotationPools: RotationPoolRecord[];
  rotationPoolMembers: RotationPoolMemberRecord[];
  trackingProfiles: TrackingProfileRecord[];
  handoffStrategies: HandoffStrategyRecord[];
  leads: LeadRecord[];
  leadViews: LeadView[];
  assignments: AssignmentRecord[];
  events: EventRecord[];
  memberProfile: MemberProfile;
  remindersSummary: LeadRemindersSummary;
};
