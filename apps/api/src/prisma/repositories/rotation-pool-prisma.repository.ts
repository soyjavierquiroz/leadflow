import { Injectable } from '@nestjs/common';
import { RotationStrategy as PrismaRotationStrategy } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { mapRotationPoolRecord, rotationPoolInclude } from '../prisma.mappers';
import type { CreateRotationPoolDto } from '../../modules/rotation-pools/dto/create-rotation-pool.dto';
import type {
  RotationPool,
  RotationPoolRepository,
} from '../../modules/rotation-pools/interfaces/rotation-pool.interface';

const toDbStrategy = (value: string): PrismaRotationStrategy => {
  switch (value) {
    case 'round-robin':
      return 'round_robin';
    case 'weighted':
    case 'manual':
      return value;
    default:
      return 'round_robin';
  }
};

@Injectable()
export class RotationPoolPrismaRepository implements RotationPoolRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<RotationPool[]> {
    const records = await this.prisma.rotationPool.findMany({
      include: rotationPoolInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapRotationPoolRecord);
  }

  async findById(id: string): Promise<RotationPool | null> {
    const record = await this.prisma.rotationPool.findUnique({
      where: { id },
      include: rotationPoolInclude,
    });

    return record ? mapRotationPoolRecord(record) : null;
  }

  async findByTeamId(teamId: string): Promise<RotationPool[]> {
    const records = await this.prisma.rotationPool.findMany({
      where: { teamId },
      include: rotationPoolInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapRotationPoolRecord);
  }

  async findByWorkspaceId(workspaceId: string): Promise<RotationPool[]> {
    const records = await this.prisma.rotationPool.findMany({
      where: { workspaceId },
      include: rotationPoolInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapRotationPoolRecord);
  }

  async create(data: CreateRotationPoolDto): Promise<RotationPool> {
    const record = await this.prisma.rotationPool.create({
      data: {
        workspaceId: data.workspaceId,
        teamId: data.teamId,
        name: data.name,
        status: 'draft',
        strategy: toDbStrategy(data.strategy ?? 'round-robin'),
        isFallbackPool: data.isFallbackPool ?? false,
        members:
          data.sponsorIds && data.sponsorIds.length > 0
            ? {
                create: data.sponsorIds.map((sponsorId, index) => ({
                  sponsorId,
                  position: index + 1,
                  weight: 1,
                  isActive: true,
                })),
              }
            : undefined,
      },
      include: rotationPoolInclude,
    });

    return mapRotationPoolRecord(record);
  }

  async save(entity: RotationPool): Promise<RotationPool> {
    const record = await this.prisma.rotationPool.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        teamId: entity.teamId,
        name: entity.name,
        status: entity.status,
        strategy: toDbStrategy(entity.strategy),
        isFallbackPool: entity.isFallbackPool,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
        members:
          entity.sponsorIds.length > 0
            ? {
                create: entity.sponsorIds.map((sponsorId, index) => ({
                  sponsorId,
                  position: index + 1,
                  weight: 1,
                  isActive: true,
                })),
              }
            : undefined,
      },
      update: {
        teamId: entity.teamId,
        name: entity.name,
        status: entity.status,
        strategy: toDbStrategy(entity.strategy),
        isFallbackPool: entity.isFallbackPool,
        members: {
          deleteMany: {},
          create: entity.sponsorIds.map((sponsorId, index) => ({
            sponsorId,
            position: index + 1,
            weight: 1,
            isActive: true,
          })),
        },
      },
      include: rotationPoolInclude,
    });

    return mapRotationPoolRecord(record);
  }
}
