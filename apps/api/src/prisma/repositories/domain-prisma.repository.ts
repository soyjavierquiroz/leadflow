import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { mapDomainRecord } from '../prisma.mappers';
import type { CreateDomainDto } from '../../modules/domains/dto/create-domain.dto';
import type {
  DomainEntity,
  DomainRepository,
} from '../../modules/domains/interfaces/domain.interface';

@Injectable()
export class DomainPrismaRepository implements DomainRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<DomainEntity[]> {
    const records = await this.prisma.domain.findMany({
      orderBy: [{ host: 'asc' }, { createdAt: 'asc' }],
    });

    return records.map(mapDomainRecord);
  }

  async findById(id: string): Promise<DomainEntity | null> {
    const record = await this.prisma.domain.findUnique({ where: { id } });
    return record ? mapDomainRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<DomainEntity[]> {
    const records = await this.prisma.domain.findMany({
      where: { workspaceId },
      orderBy: [{ host: 'asc' }, { createdAt: 'asc' }],
    });

    return records.map(mapDomainRecord);
  }

  async findByTeamId(teamId: string): Promise<DomainEntity[]> {
    const records = await this.prisma.domain.findMany({
      where: { teamId },
      orderBy: [{ host: 'asc' }, { createdAt: 'asc' }],
    });

    return records.map(mapDomainRecord);
  }

  async findByHost(host: string): Promise<DomainEntity | null> {
    const record = await this.prisma.domain.findUnique({ where: { host } });
    return record ? mapDomainRecord(record) : null;
  }

  async create(data: CreateDomainDto): Promise<DomainEntity> {
    const record = await this.prisma.domain.create({
      data: {
        workspaceId: data.workspaceId,
        teamId: data.teamId,
        host: data.host,
        status: 'draft',
        kind: data.kind ?? 'apex',
        isPrimary: data.isPrimary ?? false,
      },
    });

    return mapDomainRecord(record);
  }

  async save(entity: DomainEntity): Promise<DomainEntity> {
    const record = await this.prisma.domain.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        teamId: entity.teamId,
        host: entity.host,
        status: entity.status,
        kind: entity.kind,
        isPrimary: entity.isPrimary,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        teamId: entity.teamId,
        host: entity.host,
        status: entity.status,
        kind: entity.kind,
        isPrimary: entity.isPrimary,
      },
    });

    return mapDomainRecord(record);
  }
}
