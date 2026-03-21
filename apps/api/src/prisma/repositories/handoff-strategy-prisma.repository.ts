import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { mapHandoffStrategyRecord } from '../prisma.mappers';
import type { CreateHandoffStrategyDto } from '../../modules/handoff-strategies/dto/create-handoff-strategy.dto';
import type {
  HandoffStrategy,
  HandoffStrategyRepository,
} from '../../modules/handoff-strategies/interfaces/handoff-strategy.interface';
import type { JsonValue } from '../../modules/shared/domain.types';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

@Injectable()
export class HandoffStrategyPrismaRepository implements HandoffStrategyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<HandoffStrategy[]> {
    const records = await this.prisma.handoffStrategy.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapHandoffStrategyRecord);
  }

  async findById(id: string): Promise<HandoffStrategy | null> {
    const record = await this.prisma.handoffStrategy.findUnique({
      where: { id },
    });

    return record ? mapHandoffStrategyRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<HandoffStrategy[]> {
    const records = await this.prisma.handoffStrategy.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapHandoffStrategyRecord);
  }

  async findByTeamId(teamId: string): Promise<HandoffStrategy[]> {
    const records = await this.prisma.handoffStrategy.findMany({
      where: { teamId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapHandoffStrategyRecord);
  }

  async create(data: CreateHandoffStrategyDto): Promise<HandoffStrategy> {
    const record = await this.prisma.handoffStrategy.create({
      data: {
        workspaceId: data.workspaceId,
        teamId: data.teamId ?? null,
        name: data.name,
        type: data.type,
        status: 'draft',
        settingsJson: toInputJson(data.settingsJson),
      },
    });

    return mapHandoffStrategyRecord(record);
  }

  async save(entity: HandoffStrategy): Promise<HandoffStrategy> {
    const record = await this.prisma.handoffStrategy.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        teamId: entity.teamId,
        name: entity.name,
        type: entity.type,
        status: entity.status,
        settingsJson: toInputJson(entity.settingsJson),
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        teamId: entity.teamId,
        name: entity.name,
        type: entity.type,
        status: entity.status,
        settingsJson: toInputJson(entity.settingsJson),
      },
    });

    return mapHandoffStrategyRecord(record);
  }
}
