import { Injectable } from '@nestjs/common';
import { LeadSourceChannel as PrismaLeadSourceChannel } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { mapFunnelRecord } from '../prisma.mappers';
import type { CreateFunnelDto } from '../../modules/funnels/dto/create-funnel.dto';
import type {
  Funnel,
  FunnelRepository,
} from '../../modules/funnels/interfaces/funnel.interface';

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
export class FunnelPrismaRepository implements FunnelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Funnel[]> {
    const records = await this.prisma.funnel.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapFunnelRecord);
  }

  async findById(id: string): Promise<Funnel | null> {
    const record = await this.prisma.funnel.findUnique({ where: { id } });
    return record ? mapFunnelRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Funnel[]> {
    const records = await this.prisma.funnel.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapFunnelRecord);
  }

  async create(data: CreateFunnelDto): Promise<Funnel> {
    const record = await this.prisma.funnel.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        code: data.code,
        thumbnailUrl: null,
        status: 'draft',
        isTemplate: data.isTemplate ?? false,
        stages: data.stages ?? ['captured', 'qualified', 'won'],
        entrySources: (
          data.entrySources ?? ['manual', 'form', 'landing-page', 'api']
        ).map((item) => toDbSource(item)),
        defaultTeamId: data.defaultTeamId ?? null,
        defaultRotationPoolId: data.defaultRotationPoolId ?? null,
      },
    });

    return mapFunnelRecord(record);
  }

  async save(entity: Funnel): Promise<Funnel> {
    const record = await this.prisma.funnel.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        name: entity.name,
        code: entity.code,
        thumbnailUrl: entity.thumbnailUrl,
        status: entity.status,
        isTemplate: entity.isTemplate,
        stages: entity.stages,
        entrySources: entity.entrySources.map((item) => toDbSource(item)),
        defaultTeamId: entity.defaultTeamId,
        defaultRotationPoolId: entity.defaultRotationPoolId,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        name: entity.name,
        code: entity.code,
        thumbnailUrl: entity.thumbnailUrl,
        status: entity.status,
        isTemplate: entity.isTemplate,
        stages: entity.stages,
        entrySources: entity.entrySources.map((item) => toDbSource(item)),
        defaultTeamId: entity.defaultTeamId,
        defaultRotationPoolId: entity.defaultRotationPoolId,
      },
    });

    return mapFunnelRecord(record);
  }
}
