import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  mapTrackingProfileRecord,
  trackingProfileInclude,
} from '../prisma.mappers';
import type { CreateTrackingProfileDto } from '../../modules/tracking-profiles/dto/create-tracking-profile.dto';
import type {
  TrackingProfile,
  TrackingProfileRepository,
} from '../../modules/tracking-profiles/interfaces/tracking-profile.interface';
import type { JsonValue } from '../../modules/shared/domain.types';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

@Injectable()
export class TrackingProfilePrismaRepository implements TrackingProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TrackingProfile[]> {
    const records = await this.prisma.trackingProfile.findMany({
      include: trackingProfileInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapTrackingProfileRecord);
  }

  async findById(id: string): Promise<TrackingProfile | null> {
    const record = await this.prisma.trackingProfile.findUnique({
      where: { id },
      include: trackingProfileInclude,
    });

    return record ? mapTrackingProfileRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<TrackingProfile[]> {
    const records = await this.prisma.trackingProfile.findMany({
      where: { workspaceId },
      include: trackingProfileInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapTrackingProfileRecord);
  }

  async findByTeamId(teamId: string): Promise<TrackingProfile[]> {
    const records = await this.prisma.trackingProfile.findMany({
      where: { teamId },
      include: trackingProfileInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapTrackingProfileRecord);
  }

  async create(data: CreateTrackingProfileDto): Promise<TrackingProfile> {
    const record = await this.prisma.trackingProfile.create({
      data: {
        workspaceId: data.workspaceId,
        teamId: data.teamId,
        name: data.name,
        provider: data.provider,
        status: 'draft',
        configJson: toInputJson(data.configJson),
        deduplicationMode: data.deduplicationMode ?? 'browser_server',
      },
      include: trackingProfileInclude,
    });

    return mapTrackingProfileRecord(record);
  }

  async save(entity: TrackingProfile): Promise<TrackingProfile> {
    const record = await this.prisma.trackingProfile.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        teamId: entity.teamId,
        name: entity.name,
        provider: entity.provider,
        status: entity.status,
        configJson: toInputJson(entity.configJson),
        deduplicationMode: entity.deduplicationMode,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        teamId: entity.teamId,
        name: entity.name,
        provider: entity.provider,
        status: entity.status,
        configJson: toInputJson(entity.configJson),
        deduplicationMode: entity.deduplicationMode,
      },
      include: trackingProfileInclude,
    });

    return mapTrackingProfileRecord(record);
  }
}
