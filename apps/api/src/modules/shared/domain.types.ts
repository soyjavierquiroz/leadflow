export type DomainId = string;
export type ISODateString = string;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface BaseDomainEntity {
  id: DomainId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface WorkspaceScoped {
  workspaceId: DomainId;
}

export interface TeamScoped {
  teamId: DomainId;
}

export interface RepositoryPort<TEntity, TCreateDto> {
  findAll(): Promise<TEntity[]>;
  findById(id: DomainId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
  create(data: TCreateDto): Promise<TEntity>;
}

export type LeadSourceChannel =
  | 'manual'
  | 'form'
  | 'landing-page'
  | 'api'
  | 'import'
  | 'automation'
  | 'ORGANIC'
  | 'PAID';

export type AvailabilityStatus = 'available' | 'paused' | 'offline';

export type RotationStrategy = 'round-robin' | 'weighted' | 'manual';
export type TrafficLayer = 'DIRECT' | 'PAID_WHEEL' | 'ORGANIC';

export type EventActorType = 'system' | 'user' | 'visitor' | 'integration';

export type EventAggregateType =
  | 'workspace'
  | 'team'
  | 'sponsor'
  | 'rotation-pool'
  | 'rotation-member'
  | 'funnel'
  | 'domain'
  | 'funnel-template'
  | 'funnel-instance'
  | 'funnel-step'
  | 'funnel-publication'
  | 'tracking-profile'
  | 'conversion-event-mapping'
  | 'handoff-strategy'
  | 'visitor'
  | 'lead'
  | 'assignment'
  | 'event';

export type DomainType =
  | 'system_subdomain'
  | 'custom_apex'
  | 'custom_subdomain';
export type DomainOnboardingStatus =
  | 'draft'
  | 'pending_dns'
  | 'pending_validation'
  | 'active'
  | 'error';
export type DomainVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'failed';
export type DomainSslStatus = 'unconfigured' | 'pending' | 'active' | 'failed';
export type DomainVerificationMethod = 'none' | 'cname' | 'txt' | 'http';
export type TrackingProvider = 'meta' | 'tiktok' | 'custom';
export type DeduplicationMode =
  | 'browser_server'
  | 'browser_only'
  | 'server_only';
export type HandoffStrategyType =
  | 'immediate_whatsapp'
  | 'immediate_internal_assignment'
  | 'deferred_queue'
  | 'deferred_review'
  | 'scheduled_followup'
  | 'content_continuation';
export type FunnelStepType =
  | 'landing'
  | 'lead_capture'
  | 'thank_you'
  | 'vsl'
  | 'presentation'
  | 'qualification'
  | 'cta_bridge'
  | 'handoff'
  | 'confirmation'
  | 'redirect';
