import type { CreateEventDto } from '../dto/create-event.dto';
import type {
  BaseDomainEntity,
  DomainId,
  EventActorType,
  EventAggregateType,
  ISODateString,
  RepositoryPort,
  WorkspaceScoped,
} from '../../shared/domain.types';

export interface DomainEvent extends BaseDomainEntity, WorkspaceScoped {
  aggregateType: EventAggregateType;
  aggregateId: DomainId;
  eventName: string;
  actorType: EventActorType;
  payload: Record<string, unknown>;
  occurredAt: ISODateString;
  visitorId: DomainId | null;
  leadId: DomainId | null;
  assignmentId: DomainId | null;
}

export interface DomainEventRepository extends RepositoryPort<
  DomainEvent,
  CreateEventDto
> {
  findByAggregate(
    aggregateType: EventAggregateType,
    aggregateId: DomainId,
  ): Promise<DomainEvent[]>;
}
