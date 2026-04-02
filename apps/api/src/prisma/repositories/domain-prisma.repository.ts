import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

const toNullableJsonInput = (
  value: DomainEntity['cloudflareStatusJson'],
): Prisma.InputJsonValue | typeof Prisma.DbNull => {
  if (value === null) {
    return Prisma.DbNull;
  }

  return value as Prisma.InputJsonValue;
};

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
        linkedFunnelId: data.linkedFunnelId ?? null,
        host: data.host.trim(),
        normalizedHost,
        status: 'draft',
        onboardingStatus: 'draft',
        domainType: data.domainType ?? 'custom_apex',
        isPrimary: data.isPrimary ?? false,
        canonicalHost,
        redirectToPrimary: data.redirectToPrimary ?? false,
        verificationStatus: 'unverified',
        sslStatus: 'unconfigured',
        verificationMethod: data.verificationMethod ?? 'none',
        cloudflareCustomHostnameId: null,
        cloudflareStatusJson: Prisma.DbNull,
        dnsTarget: null,
        lastCloudflareSyncAt: null,
        activatedAt: null,
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
        linkedFunnelId: entity.linkedFunnelId,
        host: entity.host.trim(),
        normalizedHost,
        status: entity.status,
        onboardingStatus: entity.onboardingStatus,
        domainType: entity.domainType,
        isPrimary: entity.isPrimary,
        canonicalHost,
        redirectToPrimary: entity.redirectToPrimary,
        verificationStatus: entity.verificationStatus,
        sslStatus: entity.sslStatus,
        verificationMethod: entity.verificationMethod,
        cloudflareCustomHostnameId: entity.cloudflareCustomHostnameId,
        cloudflareStatusJson: toNullableJsonInput(entity.cloudflareStatusJson),
        dnsTarget: entity.dnsTarget,
        lastCloudflareSyncAt: entity.lastCloudflareSyncAt
          ? new Date(entity.lastCloudflareSyncAt)
          : null,
        activatedAt: entity.activatedAt ? new Date(entity.activatedAt) : null,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        teamId: entity.teamId,
        linkedFunnelId: entity.linkedFunnelId,
        host: entity.host.trim(),
        normalizedHost,
        status: entity.status,
        onboardingStatus: entity.onboardingStatus,
        domainType: entity.domainType,
        isPrimary: entity.isPrimary,
        canonicalHost,
        redirectToPrimary: entity.redirectToPrimary,
        verificationStatus: entity.verificationStatus,
        sslStatus: entity.sslStatus,
        verificationMethod: entity.verificationMethod,
        cloudflareCustomHostnameId: entity.cloudflareCustomHostnameId,
        cloudflareStatusJson: toNullableJsonInput(entity.cloudflareStatusJson),
        dnsTarget: entity.dnsTarget,
        lastCloudflareSyncAt: entity.lastCloudflareSyncAt
          ? new Date(entity.lastCloudflareSyncAt)
          : null,
        activatedAt: entity.activatedAt ? new Date(entity.activatedAt) : null,
      },
    });

    return mapDomainRecord(record);
  }
}
