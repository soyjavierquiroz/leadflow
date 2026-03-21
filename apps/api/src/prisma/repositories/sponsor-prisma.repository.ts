import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { mapSponsorRecord } from '../prisma.mappers';
import type { CreateSponsorDto } from '../../modules/sponsors/dto/create-sponsor.dto';
import type {
  Sponsor,
  SponsorRepository,
} from '../../modules/sponsors/interfaces/sponsor.interface';

@Injectable()
export class SponsorPrismaRepository implements SponsorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Sponsor[]> {
    const records = await this.prisma.sponsor.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapSponsorRecord);
  }

  async findById(id: string): Promise<Sponsor | null> {
    const record = await this.prisma.sponsor.findUnique({ where: { id } });
    return record ? mapSponsorRecord(record) : null;
  }

  async findByTeamId(teamId: string): Promise<Sponsor[]> {
    const records = await this.prisma.sponsor.findMany({
      where: { teamId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapSponsorRecord);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Sponsor[]> {
    const records = await this.prisma.sponsor.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapSponsorRecord);
  }

  async create(data: CreateSponsorDto): Promise<Sponsor> {
    const record = await this.prisma.sponsor.create({
      data: {
        workspaceId: data.workspaceId,
        teamId: data.teamId,
        displayName: data.displayName,
        status: 'draft',
        email: data.email ?? null,
        phone: data.phone ?? null,
        availabilityStatus: data.availabilityStatus ?? 'available',
        routingWeight: data.routingWeight ?? 1,
        memberPortalEnabled: data.memberPortalEnabled ?? true,
      },
    });

    return mapSponsorRecord(record);
  }

  async save(entity: Sponsor): Promise<Sponsor> {
    const record = await this.prisma.sponsor.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        teamId: entity.teamId,
        displayName: entity.displayName,
        status: entity.status,
        email: entity.email,
        phone: entity.phone,
        availabilityStatus: entity.availabilityStatus,
        routingWeight: entity.routingWeight,
        memberPortalEnabled: entity.memberPortalEnabled,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        teamId: entity.teamId,
        displayName: entity.displayName,
        status: entity.status,
        email: entity.email,
        phone: entity.phone,
        availabilityStatus: entity.availabilityStatus,
        routingWeight: entity.routingWeight,
        memberPortalEnabled: entity.memberPortalEnabled,
      },
    });

    return mapSponsorRecord(record);
  }
}
