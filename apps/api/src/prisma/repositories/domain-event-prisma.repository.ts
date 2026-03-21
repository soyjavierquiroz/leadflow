import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  EventAggregateType as PrismaEventAggregateType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { mapDomainEventRecord } from '../prisma.mappers';
import type { CreateEventDto } from '../../modules/events/dto/create-event.dto';
import type {
  DomainEvent,
  DomainEventRepository,
} from '../../modules/events/interfaces/event.interface';

const toDbAggregateType = (value: string): PrismaEventAggregateType => {
  switch (value) {
    case 'workspace':
    case 'team':
    case 'sponsor':
    case 'funnel':
    case 'domain':
    case 'visitor':
    case 'lead':
    case 'assignment':
    case 'event':
      return value;
    case 'rotation-pool':
      return 'rotation_pool';
    case 'rotation-member':
      return 'rotation_member';
    case 'funnel-template':
      return 'funnel_template';
    case 'funnel-instance':
      return 'funnel_instance';
    case 'funnel-step':
      return 'funnel_step';
    case 'funnel-publication':
      return 'funnel_publication';
    case 'tracking-profile':
      return 'tracking_profile';
    case 'conversion-event-mapping':
      return 'conversion_event_mapping';
    case 'handoff-strategy':
      return 'handoff_strategy';
    default:
      return 'event';
  }
};

const toInputJson = (value: Record<string, unknown>): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

@Injectable()
export class DomainEventPrismaRepository implements DomainEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<DomainEvent[]> {
    const records = await this.prisma.domainEvent.findMany({
      orderBy: { occurredAt: 'desc' },
    });

    return records.map(mapDomainEventRecord);
  }

  async findById(id: string): Promise<DomainEvent | null> {
    const record = await this.prisma.domainEvent.findUnique({ where: { id } });
    return record ? mapDomainEventRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<DomainEvent[]> {
    const records = await this.prisma.domainEvent.findMany({
      where: { workspaceId },
      orderBy: { occurredAt: 'desc' },
    });

    return records.map(mapDomainEventRecord);
  }

  async findByLeadId(leadId: string): Promise<DomainEvent[]> {
    const records = await this.prisma.domainEvent.findMany({
      where: { leadId },
      orderBy: { occurredAt: 'desc' },
    });

    return records.map(mapDomainEventRecord);
  }

  async findByPublicationId(
    funnelPublicationId: string,
  ): Promise<DomainEvent[]> {
    const records = await this.prisma.domainEvent.findMany({
      where: { funnelPublicationId },
      orderBy: { occurredAt: 'desc' },
    });

    return records.map(mapDomainEventRecord);
  }

  async findByAggregate(
    aggregateType: DomainEvent['aggregateType'],
    aggregateId: string,
  ): Promise<DomainEvent[]> {
    const records = await this.prisma.domainEvent.findMany({
      where: {
        aggregateType: toDbAggregateType(aggregateType),
        aggregateId,
      },
      orderBy: { occurredAt: 'desc' },
    });

    return records.map(mapDomainEventRecord);
  }

  async create(data: CreateEventDto): Promise<DomainEvent> {
    const record = await this.prisma.domainEvent.create({
      data: {
        workspaceId: data.workspaceId,
        eventId: data.eventId ?? randomUUID(),
        aggregateType: toDbAggregateType(data.aggregateType),
        aggregateId: data.aggregateId,
        eventName: data.eventName,
        actorType: data.actorType,
        payload: toInputJson(data.payload ?? {}),
        occurredAt: new Date(),
        funnelInstanceId: data.funnelInstanceId ?? null,
        funnelPublicationId: data.funnelPublicationId ?? null,
        funnelStepId: data.funnelStepId ?? null,
        visitorId: data.visitorId ?? null,
        leadId: data.leadId ?? null,
        assignmentId: data.assignmentId ?? null,
      },
    });

    return mapDomainEventRecord(record);
  }

  async save(entity: DomainEvent): Promise<DomainEvent> {
    const record = await this.prisma.domainEvent.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        eventId: entity.eventId,
        aggregateType: toDbAggregateType(entity.aggregateType),
        aggregateId: entity.aggregateId,
        eventName: entity.eventName,
        actorType: entity.actorType,
        payload: toInputJson(entity.payload),
        occurredAt: new Date(entity.occurredAt),
        funnelInstanceId: entity.funnelInstanceId,
        funnelPublicationId: entity.funnelPublicationId,
        funnelStepId: entity.funnelStepId,
        visitorId: entity.visitorId,
        leadId: entity.leadId,
        assignmentId: entity.assignmentId,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        eventId: entity.eventId,
        aggregateType: toDbAggregateType(entity.aggregateType),
        aggregateId: entity.aggregateId,
        eventName: entity.eventName,
        actorType: entity.actorType,
        payload: toInputJson(entity.payload),
        occurredAt: new Date(entity.occurredAt),
        funnelInstanceId: entity.funnelInstanceId,
        funnelPublicationId: entity.funnelPublicationId,
        funnelStepId: entity.funnelStepId,
        visitorId: entity.visitorId,
        leadId: entity.leadId,
        assignmentId: entity.assignmentId,
      },
    });

    return mapDomainEventRecord(record);
  }
}
