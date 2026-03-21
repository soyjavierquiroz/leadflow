import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  funnelInstanceInclude,
  mapFunnelInstanceRecord,
} from '../prisma.mappers';
import type { CreateFunnelInstanceDto } from '../../modules/funnel-instances/dto/create-funnel-instance.dto';
import type {
  FunnelInstance,
  FunnelInstanceRepository,
} from '../../modules/funnel-instances/interfaces/funnel-instance.interface';
import type { JsonValue } from '../../modules/shared/domain.types';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

@Injectable()
export class FunnelInstancePrismaRepository implements FunnelInstanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<FunnelInstance[]> {
    const records = await this.prisma.funnelInstance.findMany({
      include: funnelInstanceInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapFunnelInstanceRecord);
  }

  async findById(id: string): Promise<FunnelInstance | null> {
    const record = await this.prisma.funnelInstance.findUnique({
      where: { id },
      include: funnelInstanceInclude,
    });

    return record ? mapFunnelInstanceRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<FunnelInstance[]> {
    const records = await this.prisma.funnelInstance.findMany({
      where: { workspaceId },
      include: funnelInstanceInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapFunnelInstanceRecord);
  }

  async findByTeamId(teamId: string): Promise<FunnelInstance[]> {
    const records = await this.prisma.funnelInstance.findMany({
      where: { teamId },
      include: funnelInstanceInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapFunnelInstanceRecord);
  }

  async create(data: CreateFunnelInstanceDto): Promise<FunnelInstance> {
    const record = await this.prisma.funnelInstance.create({
      data: {
        workspaceId: data.workspaceId,
        teamId: data.teamId,
        templateId: data.templateId,
        legacyFunnelId: data.legacyFunnelId ?? null,
        name: data.name,
        code: data.code,
        status: 'draft',
        rotationPoolId: data.rotationPoolId ?? null,
        trackingProfileId: data.trackingProfileId ?? null,
        handoffStrategyId: data.handoffStrategyId ?? null,
        settingsJson: toInputJson(data.settingsJson),
        mediaMap: toInputJson(data.mediaMap),
      },
      include: funnelInstanceInclude,
    });

    return mapFunnelInstanceRecord(record);
  }

  async save(entity: FunnelInstance): Promise<FunnelInstance> {
    const record = await this.prisma.funnelInstance.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        teamId: entity.teamId,
        templateId: entity.templateId,
        legacyFunnelId: entity.legacyFunnelId,
        name: entity.name,
        code: entity.code,
        status: entity.status,
        rotationPoolId: entity.rotationPoolId,
        trackingProfileId: entity.trackingProfileId,
        handoffStrategyId: entity.handoffStrategyId,
        settingsJson: toInputJson(entity.settingsJson),
        mediaMap: toInputJson(entity.mediaMap),
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        teamId: entity.teamId,
        templateId: entity.templateId,
        legacyFunnelId: entity.legacyFunnelId,
        name: entity.name,
        code: entity.code,
        status: entity.status,
        rotationPoolId: entity.rotationPoolId,
        trackingProfileId: entity.trackingProfileId,
        handoffStrategyId: entity.handoffStrategyId,
        settingsJson: toInputJson(entity.settingsJson),
        mediaMap: toInputJson(entity.mediaMap),
      },
      include: funnelInstanceInclude,
    });

    return mapFunnelInstanceRecord(record);
  }
}
