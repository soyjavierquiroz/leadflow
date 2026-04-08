import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { mapFunnelTemplateRecord } from '../prisma.mappers';
import type { CreateFunnelTemplateDto } from '../../modules/funnel-templates/dto/create-funnel-template.dto';
import type {
  FunnelTemplate,
  FunnelTemplateRepository,
} from '../../modules/funnel-templates/interfaces/funnel-template.interface';
import type { JsonValue } from '../../modules/shared/domain.types';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

@Injectable()
export class FunnelTemplatePrismaRepository implements FunnelTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<FunnelTemplate[]> {
    const records = await this.prisma.funnelTemplate.findMany({
      orderBy: [{ code: 'asc' }, { version: 'asc' }],
    });

    return records.map(mapFunnelTemplateRecord);
  }

  async findById(id: string): Promise<FunnelTemplate | null> {
    const record = await this.prisma.funnelTemplate.findUnique({
      where: { id },
    });
    return record ? mapFunnelTemplateRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<FunnelTemplate[]> {
    const records = await this.prisma.funnelTemplate.findMany({
      where: {
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      orderBy: [{ code: 'asc' }, { version: 'asc' }],
    });

    return records.map(mapFunnelTemplateRecord);
  }

  async create(data: CreateFunnelTemplateDto): Promise<FunnelTemplate> {
    const record = await this.prisma.funnelTemplate.create({
      data: {
        workspaceId: data.workspaceId ?? null,
        name: data.name,
        description: data.description ?? null,
        code: data.code,
        status: 'draft',
        version: data.version ?? 1,
        funnelType: data.funnelType,
        blocksJson: toInputJson(data.blocksJson),
        mediaMap: toInputJson(data.mediaMap),
        settingsJson: toInputJson(data.settingsJson),
        allowedOverridesJson: toInputJson(data.allowedOverridesJson),
        defaultHandoffStrategyId: data.defaultHandoffStrategyId ?? null,
      },
    });

    return mapFunnelTemplateRecord(record);
  }

  async save(entity: FunnelTemplate): Promise<FunnelTemplate> {
    const record = await this.prisma.funnelTemplate.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        name: entity.name,
        description: entity.description,
        code: entity.code,
        status: entity.status,
        version: entity.version,
        funnelType: entity.funnelType,
        blocksJson: toInputJson(entity.blocksJson),
        mediaMap: toInputJson(entity.mediaMap),
        settingsJson: toInputJson(entity.settingsJson),
        allowedOverridesJson: toInputJson(entity.allowedOverridesJson),
        defaultHandoffStrategyId: entity.defaultHandoffStrategyId,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        workspaceId: entity.workspaceId,
        name: entity.name,
        description: entity.description,
        code: entity.code,
        status: entity.status,
        version: entity.version,
        funnelType: entity.funnelType,
        blocksJson: toInputJson(entity.blocksJson),
        mediaMap: toInputJson(entity.mediaMap),
        settingsJson: toInputJson(entity.settingsJson),
        allowedOverridesJson: toInputJson(entity.allowedOverridesJson),
        defaultHandoffStrategyId: entity.defaultHandoffStrategyId,
      },
    });

    return mapFunnelTemplateRecord(record);
  }
}
