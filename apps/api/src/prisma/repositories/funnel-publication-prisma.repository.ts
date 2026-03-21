import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { mapFunnelPublicationRecord } from '../prisma.mappers';
import type { CreateFunnelPublicationDto } from '../../modules/funnel-publications/dto/create-funnel-publication.dto';
import type {
  FunnelPublication,
  FunnelPublicationRepository,
} from '../../modules/funnel-publications/interfaces/funnel-publication.interface';

@Injectable()
export class FunnelPublicationPrismaRepository implements FunnelPublicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<FunnelPublication[]> {
    const records = await this.prisma.funnelPublication.findMany({
      orderBy: [{ domainId: 'asc' }, { pathPrefix: 'asc' }],
    });

    return records.map(mapFunnelPublicationRecord);
  }

  async findById(id: string): Promise<FunnelPublication | null> {
    const record = await this.prisma.funnelPublication.findUnique({
      where: { id },
    });
    return record ? mapFunnelPublicationRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<FunnelPublication[]> {
    const records = await this.prisma.funnelPublication.findMany({
      where: { workspaceId },
      orderBy: [{ domainId: 'asc' }, { pathPrefix: 'asc' }],
    });

    return records.map(mapFunnelPublicationRecord);
  }

  async findByTeamId(teamId: string): Promise<FunnelPublication[]> {
    const records = await this.prisma.funnelPublication.findMany({
      where: { teamId },
      orderBy: [{ domainId: 'asc' }, { pathPrefix: 'asc' }],
    });

    return records.map(mapFunnelPublicationRecord);
  }

  async findByDomainId(domainId: string): Promise<FunnelPublication[]> {
    const records = await this.prisma.funnelPublication.findMany({
      where: { domainId },
      orderBy: { pathPrefix: 'asc' },
    });

    return records.map(mapFunnelPublicationRecord);
  }

  async create(data: CreateFunnelPublicationDto): Promise<FunnelPublication> {
    const record = await this.prisma.funnelPublication.create({
      data: {
        workspaceId: data.workspaceId,
        teamId: data.teamId,
        domainId: data.domainId,
        funnelInstanceId: data.funnelInstanceId,
        trackingProfileId: data.trackingProfileId ?? null,
        handoffStrategyId: data.handoffStrategyId ?? null,
        pathPrefix: data.pathPrefix,
        status: 'draft',
        isPrimary: data.isPrimary ?? false,
      },
    });

    return mapFunnelPublicationRecord(record);
  }

  async save(entity: FunnelPublication): Promise<FunnelPublication> {
    const record = await this.prisma.funnelPublication.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        teamId: entity.teamId,
        domainId: entity.domainId,
        funnelInstanceId: entity.funnelInstanceId,
        trackingProfileId: entity.trackingProfileId,
        handoffStrategyId: entity.handoffStrategyId,
        pathPrefix: entity.pathPrefix,
        status: entity.status,
        isPrimary: entity.isPrimary,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        teamId: entity.teamId,
        domainId: entity.domainId,
        funnelInstanceId: entity.funnelInstanceId,
        trackingProfileId: entity.trackingProfileId,
        handoffStrategyId: entity.handoffStrategyId,
        pathPrefix: entity.pathPrefix,
        status: entity.status,
        isPrimary: entity.isPrimary,
      },
    });

    return mapFunnelPublicationRecord(record);
  }
}
