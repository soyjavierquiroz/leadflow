import { Injectable } from '@nestjs/common';
import { LeadSourceChannel as PrismaLeadSourceChannel } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { mapVisitorRecord, visitorInclude } from '../prisma.mappers';
import type { CreateVisitorDto } from '../../modules/visitors/dto/create-visitor.dto';
import type {
  Visitor,
  VisitorRepository,
} from '../../modules/visitors/interfaces/visitor.interface';

const toDbSource = (value: string): PrismaLeadSourceChannel => {
  switch (value) {
    case 'landing-page':
      return 'landing_page';
    case 'manual':
    case 'form':
    case 'api':
    case 'import':
    case 'automation':
      return value;
    default:
      return 'manual';
  }
};

@Injectable()
export class VisitorPrismaRepository implements VisitorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Visitor[]> {
    const records = await this.prisma.visitor.findMany({
      include: visitorInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapVisitorRecord);
  }

  async findById(id: string): Promise<Visitor | null> {
    const record = await this.prisma.visitor.findUnique({
      where: { id },
      include: visitorInclude,
    });

    return record ? mapVisitorRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Visitor[]> {
    const records = await this.prisma.visitor.findMany({
      where: { workspaceId },
      include: visitorInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapVisitorRecord);
  }

  async findByAnonymousId(
    workspaceId: string,
    anonymousId: string,
  ): Promise<Visitor | null> {
    const record = await this.prisma.visitor.findUnique({
      where: {
        workspaceId_anonymousId: {
          workspaceId,
          anonymousId,
        },
      },
      include: visitorInclude,
    });

    return record ? mapVisitorRecord(record) : null;
  }

  async create(data: CreateVisitorDto): Promise<Visitor> {
    const seenAt = new Date();
    const record = await this.prisma.visitor.create({
      data: {
        workspaceId: data.workspaceId,
        anonymousId: data.anonymousId,
        kind: data.kind ?? 'anonymous',
        status: 'active',
        sourceChannel: toDbSource(data.sourceChannel),
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
        utmSource: data.utmSource ?? null,
        utmCampaign: data.utmCampaign ?? null,
      },
      include: visitorInclude,
    });

    return mapVisitorRecord(record);
  }

  async save(entity: Visitor): Promise<Visitor> {
    const record = await this.prisma.visitor.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        anonymousId: entity.anonymousId,
        kind: entity.kind,
        status: entity.status,
        sourceChannel: toDbSource(entity.sourceChannel),
        firstSeenAt: new Date(entity.firstSeenAt),
        lastSeenAt: new Date(entity.lastSeenAt),
        utmSource: entity.utmSource,
        utmCampaign: entity.utmCampaign,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        anonymousId: entity.anonymousId,
        kind: entity.kind,
        status: entity.status,
        sourceChannel: toDbSource(entity.sourceChannel),
        firstSeenAt: new Date(entity.firstSeenAt),
        lastSeenAt: new Date(entity.lastSeenAt),
        utmSource: entity.utmSource,
        utmCampaign: entity.utmCampaign,
      },
      include: visitorInclude,
    });

    return mapVisitorRecord(record);
  }
}
