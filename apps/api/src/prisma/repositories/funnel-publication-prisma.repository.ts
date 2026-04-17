import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { mapFunnelPublicationRecord } from '../prisma.mappers';
import { normalizePublicationPathPrefix } from '../../modules/shared/publication-resolution.utils';
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
    const createData = {
      workspaceId: data.workspaceId,
      teamId: data.teamId,
      domainId: data.domainId,
      funnelInstanceId: data.funnelInstanceId,
      trackingProfileId: data.trackingProfileId ?? null,
      handoffStrategyId: data.handoffStrategyId ?? null,
      metaPixelId: data.metaPixelId ?? null,
      tiktokPixelId: data.tiktokPixelId ?? null,
      metaCapiToken: data.metaCapiToken ?? null,
      tiktokAccessToken: data.tiktokAccessToken ?? null,
      pathPrefix: normalizePublicationPathPrefix(data.pathPrefix),
      status: data.isActive ? 'active' : 'draft',
      isActive: data.isActive ?? false,
      isPrimary: data.isPrimary ?? false,
    } as Prisma.FunnelPublicationUncheckedCreateInput;

    const record = await this.prisma.funnelPublication.create({
      data: createData,
    });

    return mapFunnelPublicationRecord(record);
  }

  async save(entity: FunnelPublication): Promise<FunnelPublication> {
    const createData = {
      id: entity.id,
      workspaceId: entity.workspaceId,
      teamId: entity.teamId,
      domainId: entity.domainId,
      funnelInstanceId: entity.funnelInstanceId,
      trackingProfileId: entity.trackingProfileId,
      handoffStrategyId: entity.handoffStrategyId,
      metaPixelId: entity.metaPixelId,
      tiktokPixelId: entity.tiktokPixelId,
      metaCapiToken: entity.metaCapiToken,
      tiktokAccessToken: entity.tiktokAccessToken,
      pathPrefix: normalizePublicationPathPrefix(entity.pathPrefix),
      status: entity.status,
      isActive: entity.isActive,
      isPrimary: entity.isPrimary,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    } as Prisma.FunnelPublicationUncheckedCreateInput;
    const updateData = {
      teamId: entity.teamId,
      domainId: entity.domainId,
      funnelInstanceId: entity.funnelInstanceId,
      trackingProfileId: entity.trackingProfileId,
      handoffStrategyId: entity.handoffStrategyId,
      metaPixelId: entity.metaPixelId,
      tiktokPixelId: entity.tiktokPixelId,
      metaCapiToken: entity.metaCapiToken,
      tiktokAccessToken: entity.tiktokAccessToken,
      pathPrefix: normalizePublicationPathPrefix(entity.pathPrefix),
      status: entity.status,
      isActive: entity.isActive,
      isPrimary: entity.isPrimary,
    } as Prisma.FunnelPublicationUncheckedUpdateInput;

    const record = await this.prisma.funnelPublication.upsert({
      where: { id: entity.id },
      create: createData,
      update: updateData,
    });

    return mapFunnelPublicationRecord(record);
  }
}
