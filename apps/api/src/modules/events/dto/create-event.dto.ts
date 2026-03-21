import type {
  EventActorType,
  EventAggregateType,
} from '../../shared/domain.types';

export class CreateEventDto {
  readonly workspaceId!: string;
  readonly aggregateType!: EventAggregateType;
  readonly aggregateId!: string;
  readonly eventName!: string;
  readonly actorType!: EventActorType;
  readonly payload?: Record<string, unknown>;
  readonly visitorId?: string | null;
  readonly leadId?: string | null;
  readonly assignmentId?: string | null;
}
