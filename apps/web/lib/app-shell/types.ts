export type CollectionSource = "live" | "mock";
export type DataSourceMode = "live" | "mock" | "hybrid";

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
  status: string;
  kind: string;
  isPrimary: boolean;
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
  currentAssignmentId: string | null;
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
  leads: LeadRecord[];
  leadViews: LeadView[];
  assignments: AssignmentRecord[];
  events: EventRecord[];
  memberProfile: MemberProfile;
};
