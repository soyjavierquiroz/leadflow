import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mapDomainRecord } from '../../prisma/prisma.mappers';
import { PrismaService } from '../../prisma/prisma.service';
import { buildEntity } from '../shared/domain.factory';
import { DOMAIN_REPOSITORY } from '../shared/domain.tokens';
import {
  hasNormalizedDomainHost,
  normalizeDomainHost,
} from '../shared/publication-resolution.utils';
import type { CreateDomainDto } from './dto/create-domain.dto';
import type { CreateTeamDomainDto } from './dto/create-team-domain.dto';
import type { RecreateDomainOnboardingDto } from './dto/recreate-domain-onboarding.dto';
import {
  CloudflareSaasClient,
  CloudflareSaasClientError,
} from './cloudflare-saas.client';
import {
  buildDomainSummary,
  defaultVerificationMethodForDomainType,
  deriveDomainLifecycle,
  usesCloudflareSaas,
} from './domain-onboarding.utils';
import type {
  DomainEntity,
  DomainSummary,
  DomainRepository,
} from './interfaces/domain.interface';
import type { UpdateTeamDomainDto } from './dto/update-team-domain.dto';

type DeleteDomainResult = {
  id: string;
  host: string;
  deleted: true;
};

const toNullableJsonInput = (
  value: DomainEntity['cloudflareStatusJson'],
): Prisma.InputJsonValue | typeof Prisma.DbNull => {
  if (value === null) {
    return Prisma.DbNull;
  }

  return value as Prisma.InputJsonValue;
};

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflareSaasClient: CloudflareSaasClient,
    @Optional()
    @Inject(DOMAIN_REPOSITORY)
    private readonly repository?: DomainRepository,
  ) {}

  createDraft(dto: CreateDomainDto): DomainEntity {
    if (!hasNormalizedDomainHost(dto.host)) {
      throw new BadRequestException({
        code: 'HOST_REQUIRED',
        message: 'A valid host is required.',
      });
    }

    const normalizedHost = normalizeDomainHost(dto.host);
    const domainType = dto.domainType ?? 'custom_subdomain';
    const verificationMethod =
      dto.verificationMethod ??
      defaultVerificationMethodForDomainType(domainType);
    const lifecycle = deriveDomainLifecycle({
      domainType,
      dnsTarget: null,
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
    });

    return buildEntity<DomainEntity>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      host: dto.host.trim(),
      normalizedHost,
      status: lifecycle.status,
      onboardingStatus: lifecycle.onboardingStatus,
      domainType,
      isPrimary: dto.isPrimary ?? false,
      canonicalHost: dto.canonicalHost
        ? normalizeDomainHost(dto.canonicalHost)
        : normalizedHost,
      redirectToPrimary: dto.redirectToPrimary ?? false,
      verificationStatus: lifecycle.verificationStatus,
      sslStatus: lifecycle.sslStatus,
      verificationMethod,
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
      dnsTarget: null,
      lastCloudflareSyncAt: null,
      activatedAt:
        lifecycle.onboardingStatus === 'active'
          ? new Date().toISOString()
          : null,
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
  }): Promise<DomainSummary[]> {
    if (!this.repository) {
      throw new Error('DomainRepository provider is not configured.');
    }

    if (filters?.teamId) {
      return (await this.repository.findByTeamId(filters.teamId)).map(
        (domain) => this.toSummary(domain),
      );
    }

    if (filters?.workspaceId) {
      return (await this.repository.findByWorkspaceId(filters.workspaceId)).map(
        (domain) => this.toSummary(domain),
      );
    }

    return (await this.repository.findAll()).map((domain) =>
      this.toSummary(domain),
    );
  }

  async createForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    dto: CreateTeamDomainDto,
  ): Promise<DomainSummary> {
    const normalizedHost = this.assertAndNormalizeHost(dto.host);
    await this.assertHostAvailable(normalizedHost);

    const domainType = dto.domainType;
    const verificationMethod =
      dto.verificationMethod ??
      defaultVerificationMethodForDomainType(domainType);
    const dnsTarget = this.resolveDnsTarget(domainType);
    const baseLifecycle = deriveDomainLifecycle({
      domainType,
      dnsTarget,
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
    });

    const record = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.domain.updateMany({
          where: {
            teamId: scope.teamId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.domain.create({
        data: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          host: dto.host.trim(),
          normalizedHost,
          status: baseLifecycle.status,
          onboardingStatus: baseLifecycle.onboardingStatus,
          domainType,
          isPrimary: dto.isPrimary ?? false,
          canonicalHost: dto.canonicalHost
            ? normalizeDomainHost(dto.canonicalHost)
            : normalizedHost,
          redirectToPrimary: dto.redirectToPrimary ?? false,
          verificationStatus: baseLifecycle.verificationStatus,
          sslStatus: baseLifecycle.sslStatus,
          verificationMethod,
          cloudflareCustomHostnameId: null,
          cloudflareStatusJson: Prisma.DbNull,
          dnsTarget,
          lastCloudflareSyncAt: null,
          activatedAt:
            baseLifecycle.onboardingStatus === 'active' ? new Date() : null,
        },
      });
    });

    const synced = await this.syncDomainToCloudflare(mapDomainRecord(record), {
      mode: 'create',
      allowCreate: true,
    });

    return this.toSummary(synced);
  }

  async updateForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    domainId: string,
    dto: UpdateTeamDomainDto,
  ): Promise<DomainSummary> {
    const existingRecord = await this.findDomainRecord(scope, domainId);
    const existing = mapDomainRecord(existingRecord);
    const domainType = dto.domainType ?? existing.domainType;
    const host = dto.host?.trim() ?? existing.host;
    const normalizedHost = this.assertAndNormalizeHost(host);

    if (
      normalizedHost !== existing.normalizedHost &&
      usesCloudflareSaas(existing.domainType) &&
      (existing.cloudflareCustomHostnameId !== null ||
        existing.dnsTarget !== null ||
        existing.onboardingStatus !== 'draft')
    ) {
      throw new ConflictException({
        code: 'DOMAIN_HOST_CHANGE_REQUIRES_RECREATE',
        message:
          'Changing the hostname of an onboarded domain requires recreate-onboarding so Leadflow can clean up the previous Cloudflare custom hostname safely.',
      });
    }

    if (
      existing.cloudflareCustomHostnameId &&
      usesCloudflareSaas(existing.domainType) !== usesCloudflareSaas(domainType)
    ) {
      throw new ConflictException({
        code: 'DOMAIN_TYPE_CHANGE_NOT_SUPPORTED',
        message:
          'Changing a managed custom domain into a non-managed type requires a dedicated migration step.',
      });
    }

    if (normalizedHost !== existing.normalizedHost) {
      await this.assertHostAvailable(normalizedHost, existing.id);
    }

    const verificationMethod =
      dto.verificationMethod ??
      existing.verificationMethod ??
      defaultVerificationMethodForDomainType(domainType);
    const dnsTarget = this.resolveDnsTarget(domainType);

    const record = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.domain.updateMany({
          where: {
            teamId: scope.teamId,
            isPrimary: true,
            NOT: { id: existing.id },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.domain.update({
        where: { id: existing.id },
        data: {
          host,
          normalizedHost,
          domainType,
          isPrimary: dto.isPrimary ?? existing.isPrimary,
          canonicalHost:
            dto.canonicalHost !== undefined
              ? dto.canonicalHost
                ? normalizeDomainHost(dto.canonicalHost)
                : null
              : existing.canonicalHost,
          redirectToPrimary:
            dto.redirectToPrimary ?? existing.redirectToPrimary,
          verificationMethod,
          dnsTarget,
          status: dto.status ?? existing.status,
        },
      });
    });

    const synced = await this.syncDomainToCloudflare(mapDomainRecord(record), {
      mode: 'update',
      allowCreate: true,
    });

    return this.toSummary(synced);
  }

  async deleteForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    domainId: string,
  ): Promise<DeleteDomainResult> {
    const record = await this.findDomainRecord(scope, domainId);
    const domain = mapDomainRecord(record);

    await this.deleteCloudflareCustomHostname(domain);

    await this.prisma.domain.delete({
      where: { id: domain.id },
    });

    return {
      id: domain.id,
      host: domain.host,
      deleted: true,
    };
  }

  async refreshForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    domainId: string,
  ): Promise<DomainSummary> {
    const record = await this.findDomainRecord(scope, domainId);
    const synced = await this.syncDomainToCloudflare(mapDomainRecord(record), {
      mode: 'refresh',
      allowCreate: true,
    });

    return this.toSummary(synced);
  }

  async recreateOnboardingForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    domainId: string,
    dto: RecreateDomainOnboardingDto,
  ): Promise<DomainSummary> {
    const existingRecord = await this.findDomainRecord(scope, domainId);
    const existing = mapDomainRecord(existingRecord);
    const nextHost = dto.host?.trim() ?? existing.host;
    const normalizedHost = this.assertAndNormalizeHost(nextHost);
    const domainType = dto.domainType ?? existing.domainType;

    if (normalizedHost !== existing.normalizedHost) {
      await this.assertHostAvailable(normalizedHost, existing.id);
    }

    const verificationMethod =
      dto.verificationMethod ??
      existing.verificationMethod ??
      defaultVerificationMethodForDomainType(domainType);
    const dnsTarget = this.resolveDnsTarget(domainType);
    const baseLifecycle = deriveDomainLifecycle({
      domainType,
      dnsTarget,
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
    });

    await this.deleteCloudflareCustomHostname(existing);

    const record = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.domain.updateMany({
          where: {
            teamId: scope.teamId,
            isPrimary: true,
            NOT: { id: existing.id },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.domain.update({
        where: { id: existing.id },
        data: {
          host: nextHost,
          normalizedHost,
          domainType,
          isPrimary: dto.isPrimary ?? existing.isPrimary,
          canonicalHost:
            dto.canonicalHost !== undefined
              ? dto.canonicalHost
                ? normalizeDomainHost(dto.canonicalHost)
                : null
              : existing.canonicalHost,
          redirectToPrimary:
            dto.redirectToPrimary ?? existing.redirectToPrimary,
          verificationMethod,
          status: baseLifecycle.status,
          onboardingStatus: baseLifecycle.onboardingStatus,
          verificationStatus: baseLifecycle.verificationStatus,
          sslStatus: baseLifecycle.sslStatus,
          cloudflareCustomHostnameId: null,
          cloudflareStatusJson: Prisma.DbNull,
          dnsTarget,
          lastCloudflareSyncAt: null,
          activatedAt: null,
        },
      });
    });

    const synced = await this.syncDomainToCloudflare(mapDomainRecord(record), {
      mode: 'create',
      allowCreate: true,
    });

    return this.toSummary(synced);
  }

  private assertAndNormalizeHost(host: string) {
    if (!hasNormalizedDomainHost(host)) {
      throw new BadRequestException({
        code: 'HOST_REQUIRED',
        message: 'A valid host is required.',
      });
    }

    return normalizeDomainHost(host);
  }

  private async assertHostAvailable(
    normalizedHost: string,
    excludeDomainId?: string,
  ) {
    const existing = await this.prisma.domain.findFirst({
      where: {
        normalizedHost,
        ...(excludeDomainId
          ? {
              NOT: { id: excludeDomainId },
            }
          : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DOMAIN_HOST_CONFLICT',
        message: `The host ${normalizedHost} is already registered.`,
      });
    }
  }

  private async findDomainRecord(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    domainId: string,
  ) {
    const record = await this.prisma.domain.findFirst({
      where: {
        id: domainId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'DOMAIN_NOT_FOUND',
        message: 'The requested domain was not found for this team.',
      });
    }

    return record;
  }

  private async deleteCloudflareCustomHostname(domain: DomainEntity) {
    if (
      !usesCloudflareSaas(domain.domainType) ||
      !domain.cloudflareCustomHostnameId ||
      !this.cloudflareSaasClient.isConfigured()
    ) {
      return;
    }

    try {
      await this.cloudflareSaasClient.deleteCustomHostname(
        domain.cloudflareCustomHostnameId,
      );
    } catch (error) {
      if (
        error instanceof CloudflareSaasClientError &&
        (error.status === 404 || error.status === 409)
      ) {
        return;
      }

      throw error;
    }
  }

  private async syncDomainToCloudflare(
    domain: DomainEntity,
    options: {
      mode: 'create' | 'update' | 'refresh';
      allowCreate: boolean;
    },
  ): Promise<DomainEntity> {
    if (!usesCloudflareSaas(domain.domainType)) {
      return await this.applyDerivedState(domain);
    }

    if (!this.cloudflareSaasClient.isConfigured()) {
      if (options.mode === 'refresh' && domain.cloudflareCustomHostnameId) {
        throw new ConflictException({
          code: 'CLOUDFLARE_NOT_CONFIGURED',
          message: 'Cloudflare SaaS is not configured in this environment.',
        });
      }

      return await this.applyDerivedState({
        ...domain,
        dnsTarget: domain.dnsTarget ?? this.resolveDnsTarget(domain.domainType),
      });
    }

    try {
      const snapshot =
        domain.cloudflareCustomHostnameId && options.mode !== 'create'
          ? options.mode === 'update'
            ? await this.cloudflareSaasClient.updateCustomHostname(
                domain.cloudflareCustomHostnameId,
                {
                  hostname: domain.host,
                  domainType: domain.domainType,
                  verificationMethod: domain.verificationMethod,
                },
              )
            : await this.cloudflareSaasClient.refreshCustomHostname(
                domain.cloudflareCustomHostnameId,
                {
                  hostname: domain.host,
                  domainType: domain.domainType,
                  verificationMethod: domain.verificationMethod,
                },
              )
          : options.allowCreate
            ? await this.cloudflareSaasClient.createCustomHostname({
                hostname: domain.host,
                domainType: domain.domainType,
                verificationMethod: domain.verificationMethod,
              })
            : null;

      if (!snapshot) {
        return await this.applyDerivedState(domain);
      }

      return await this.applyDerivedState({
        ...domain,
        cloudflareCustomHostnameId:
          snapshot.id ?? domain.cloudflareCustomHostnameId,
        cloudflareStatusJson:
          snapshot as unknown as DomainEntity['cloudflareStatusJson'],
        dnsTarget: domain.dnsTarget ?? this.resolveDnsTarget(domain.domainType),
        lastCloudflareSyncAt: new Date().toISOString(),
      });
    } catch (error) {
      if (!(error instanceof CloudflareSaasClientError)) {
        throw error;
      }

      return await this.applyDerivedState({
        ...domain,
        cloudflareStatusJson: {
          error: {
            message: error.message,
            status: error.status,
          },
          raw: error.details ?? null,
        } as DomainEntity['cloudflareStatusJson'],
        dnsTarget: domain.dnsTarget ?? this.resolveDnsTarget(domain.domainType),
        lastCloudflareSyncAt: new Date().toISOString(),
      });
    }
  }

  private async applyDerivedState(domain: DomainEntity): Promise<DomainEntity> {
    const lifecycle = deriveDomainLifecycle({
      domainType: domain.domainType,
      dnsTarget: domain.dnsTarget,
      cloudflareCustomHostnameId: domain.cloudflareCustomHostnameId,
      cloudflareStatusJson: domain.cloudflareStatusJson,
    });

    const record = await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: lifecycle.status,
        onboardingStatus: lifecycle.onboardingStatus,
        verificationStatus: lifecycle.verificationStatus,
        sslStatus: lifecycle.sslStatus,
        dnsTarget: domain.dnsTarget,
        cloudflareCustomHostnameId: domain.cloudflareCustomHostnameId,
        cloudflareStatusJson: toNullableJsonInput(domain.cloudflareStatusJson),
        lastCloudflareSyncAt: domain.lastCloudflareSyncAt
          ? new Date(domain.lastCloudflareSyncAt)
          : null,
        activatedAt:
          lifecycle.onboardingStatus === 'active'
            ? domain.activatedAt
              ? new Date(domain.activatedAt)
              : new Date()
            : domain.activatedAt
              ? new Date(domain.activatedAt)
              : null,
      },
    });

    return mapDomainRecord(record);
  }

  private resolveDnsTarget(domainType: DomainEntity['domainType']) {
    return usesCloudflareSaas(domainType)
      ? this.cloudflareSaasClient.getCustomerCnameTarget()
      : null;
  }

  private toSummary(domain: DomainEntity): DomainSummary {
    return buildDomainSummary(domain, {
      fallbackOrigin: this.cloudflareSaasClient.getFallbackOrigin(),
      customerCnameTarget: this.cloudflareSaasClient.getCustomerCnameTarget(),
    });
  }
}
