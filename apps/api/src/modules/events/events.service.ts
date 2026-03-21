import { Injectable } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import type { CreateEventDto } from './dto/create-event.dto';
import type { DomainEvent } from './interfaces/event.interface';

@Injectable()
export class EventsService {
  createDraft(dto: CreateEventDto): DomainEvent {
    return buildEntity<DomainEvent>({
      workspaceId: dto.workspaceId,
      aggregateType: dto.aggregateType,
      aggregateId: dto.aggregateId,
      eventName: dto.eventName,
      actorType: dto.actorType,
      payload: dto.payload ?? {},
      occurredAt: new Date().toISOString(),
      visitorId: dto.visitorId ?? null,
      leadId: dto.leadId ?? null,
      assignmentId: dto.assignmentId ?? null,
    });
  }
}
