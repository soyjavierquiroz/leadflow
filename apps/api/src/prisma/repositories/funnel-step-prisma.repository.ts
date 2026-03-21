import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { mapFunnelStepRecord } from '../prisma.mappers';
import type { CreateFunnelStepDto } from '../../modules/funnel-steps/dto/create-funnel-step.dto';
import type {
  FunnelStep,
  FunnelStepRepository,
} from '../../modules/funnel-steps/interfaces/funnel-step.interface';
import type { JsonValue } from '../../modules/shared/domain.types';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

@Injectable()
export class FunnelStepPrismaRepository implements FunnelStepRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<FunnelStep[]> {
    const records = await this.prisma.funnelStep.findMany({
      orderBy: [{ funnelInstanceId: 'asc' }, { position: 'asc' }],
    });

    return records.map(mapFunnelStepRecord);
  }

  async findById(id: string): Promise<FunnelStep | null> {
    const record = await this.prisma.funnelStep.findUnique({ where: { id } });
    return record ? mapFunnelStepRecord(record) : null;
  }

  async findByFunnelInstanceId(
    funnelInstanceId: string,
  ): Promise<FunnelStep[]> {
    const records = await this.prisma.funnelStep.findMany({
      where: { funnelInstanceId },
      orderBy: { position: 'asc' },
    });

    return records.map(mapFunnelStepRecord);
  }

  async create(data: CreateFunnelStepDto): Promise<FunnelStep> {
    const record = await this.prisma.funnelStep.create({
      data: {
        workspaceId: data.workspaceId,
        teamId: data.teamId,
        funnelInstanceId: data.funnelInstanceId,
        stepType: data.stepType,
        slug: data.slug,
        position: data.position,
        isEntryStep: data.isEntryStep ?? false,
        isConversionStep: data.isConversionStep ?? false,
        blocksJson: toInputJson(data.blocksJson),
        mediaMap: toInputJson(data.mediaMap),
        settingsJson: toInputJson(data.settingsJson),
      },
    });

    return mapFunnelStepRecord(record);
  }

  async save(entity: FunnelStep): Promise<FunnelStep> {
    const record = await this.prisma.funnelStep.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        teamId: entity.teamId,
        funnelInstanceId: entity.funnelInstanceId,
        stepType: entity.stepType,
        slug: entity.slug,
        position: entity.position,
        isEntryStep: entity.isEntryStep,
        isConversionStep: entity.isConversionStep,
        blocksJson: toInputJson(entity.blocksJson),
        mediaMap: toInputJson(entity.mediaMap),
        settingsJson: toInputJson(entity.settingsJson),
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        teamId: entity.teamId,
        funnelInstanceId: entity.funnelInstanceId,
        stepType: entity.stepType,
        slug: entity.slug,
        position: entity.position,
        isEntryStep: entity.isEntryStep,
        isConversionStep: entity.isConversionStep,
        blocksJson: toInputJson(entity.blocksJson),
        mediaMap: toInputJson(entity.mediaMap),
        settingsJson: toInputJson(entity.settingsJson),
      },
    });

    return mapFunnelStepRecord(record);
  }
}
