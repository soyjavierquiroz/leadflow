import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { mapDomainRecord } from '../prisma.mappers';
import {
  hasNormalizedDomainHost,
  normalizeDomainHost,
} from '../../modules/shared/publication-resolution.utils';
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
      orderBy: [{ normalizedHost: 'asc' }, { createdAt: 'asc' }],
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
      orderBy: [{ normalizedHost: 'asc' }, { createdAt: 'asc' }],
    });

    return records.map(mapDomainRecord);
  }

  async findByTeamId(teamId: string): Promise<DomainEntity[]> {
    const records = await this.prisma.domain.findMany({
      where: { teamId },
      orderBy: [{ normalizedHost: 'asc' }, { createdAt: 'asc' }],
    });

    return records.map(mapDomainRecord);
  }

  async findByHost(host: string): Promise<DomainEntity | null> {
    const record = await this.prisma.domain.findUnique({
      where: { normalizedHost: normalizeDomainHost(host) },
    });
    return record ? mapDomainRecord(record) : null;
  }

  async create(data: CreateDomainDto): Promise<DomainEntity> {
    if (!hasNormalizedDomainHost(data.host)) {
      throw new BadRequestException({
        code: 'HOST_REQUIRED',
        message: 'A valid host is required.',
      });
    }

    const normalizedHost = normalizeDomainHost(data.host);
    const canonicalHost = data.canonicalHost
      ? normalizeDomainHost(data.canonicalHost)
      : null;

    const record = await this.prisma.domain.create({
      data: {
        workspaceId: data.workspaceId,
        teamId: data.teamId,
        host: data.host.trim(),
        normalizedHost,
        status: 'draft',
        domainType: data.domainType ?? 'custom_apex',
        isPrimary: data.isPrimary ?? false,
        canonicalHost,
        redirectToPrimary: data.redirectToPrimary ?? false,
      },
    });

    return mapDomainRecord(record);
  }

  async save(entity: DomainEntity): Promise<DomainEntity> {
    if (!hasNormalizedDomainHost(entity.host)) {
      throw new BadRequestException({
        code: 'HOST_REQUIRED',
        message: 'A valid host is required.',
      });
    }

    const normalizedHost = normalizeDomainHost(entity.host);
    const canonicalHost = entity.canonicalHost
      ? normalizeDomainHost(entity.canonicalHost)
      : null;

    const record = await this.prisma.domain.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        teamId: entity.teamId,
        host: entity.host.trim(),
        normalizedHost,
        status: entity.status,
        domainType: entity.domainType,
        isPrimary: entity.isPrimary,
        canonicalHost,
        redirectToPrimary: entity.redirectToPrimary,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        teamId: entity.teamId,
        host: entity.host.trim(),
        normalizedHost,
        status: entity.status,
        domainType: entity.domainType,
        isPrimary: entity.isPrimary,
        canonicalHost,
        redirectToPrimary: entity.redirectToPrimary,
      },
    });

    return mapDomainRecord(record);
  }
}
