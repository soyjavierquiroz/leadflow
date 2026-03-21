import { randomUUID } from 'crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { DOMAIN_EVENT_REPOSITORY } from '../shared/domain.tokens';
import type { CreateEventDto } from './dto/create-event.dto';
import type {
  DomainEvent,
  DomainEventRepository,
} from './interfaces/event.interface';

@Injectable()
export class EventsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_EVENT_REPOSITORY)
    private readonly repository?: DomainEventRepository,
  ) {}

  createDraft(dto: CreateEventDto): DomainEvent {
    return buildEntity<DomainEvent>({
      workspaceId: dto.workspaceId,
      eventId: dto.eventId ?? randomUUID(),
      aggregateType: dto.aggregateType,
      aggregateId: dto.aggregateId,
      eventName: dto.eventName,
      actorType: dto.actorType,
      payload: dto.payload ?? {},
      occurredAt: new Date().toISOString(),
      funnelInstanceId: dto.funnelInstanceId ?? null,
      funnelPublicationId: dto.funnelPublicationId ?? null,
      funnelStepId: dto.funnelStepId ?? null,
      visitorId: dto.visitorId ?? null,
      leadId: dto.leadId ?? null,
      assignmentId: dto.assignmentId ?? null,
    });
  }

  async list(filters?: {
    workspaceId?: string;
    leadId?: string;
    funnelPublicationId?: string;
  }): Promise<DomainEvent[]> {
    if (!this.repository) {
      throw new Error('DomainEventRepository provider is not configured.');
    }

    if (filters?.leadId) {
      return this.repository.findByLeadId(filters.leadId);
    }

    if (filters?.funnelPublicationId) {
      return this.repository.findByPublicationId(filters.funnelPublicationId);
    }

    if (filters?.workspaceId) {
      return this.repository.findByWorkspaceId(filters.workspaceId);
    }

    return this.repository.findAll();
  }
}
