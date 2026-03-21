import type {
  EventActorType,
  EventAggregateType,
} from '../../shared/domain.types';

export class CreateEventDto {
  readonly workspaceId!: string;
  readonly eventId?: string;
  readonly aggregateType!: EventAggregateType;
  readonly aggregateId!: string;
  readonly eventName!: string;
  readonly actorType!: EventActorType;
  readonly payload?: Record<string, unknown>;
  readonly funnelInstanceId?: string | null;
  readonly funnelPublicationId?: string | null;
  readonly funnelStepId?: string | null;
  readonly visitorId?: string | null;
  readonly leadId?: string | null;
  readonly assignmentId?: string | null;
}
