export type DomainId = string;
export type ISODateString = string;

export interface BaseDomainEntity {
  id: DomainId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface WorkspaceScoped {
  workspaceId: DomainId;
}

export interface RepositoryPort<TEntity, TCreateDto> {
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
  | 'automation';

export type AvailabilityStatus = 'available' | 'paused' | 'offline';

export type RotationStrategy = 'round-robin' | 'weighted' | 'manual';

export type EventActorType = 'system' | 'user' | 'visitor' | 'integration';

export type EventAggregateType =
  | 'workspace'
  | 'team'
  | 'sponsor'
  | 'rotation-pool'
  | 'funnel'
  | 'visitor'
  | 'lead'
  | 'assignment'
  | 'event';
