import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { FUNNEL_PUBLICATION_REPOSITORY } from '../shared/domain.tokens';
import { mapFunnelPublicationRecord } from '../../prisma/prisma.mappers';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateFunnelPublicationDto } from './dto/create-funnel-publication.dto';
import type { CreateTeamFunnelPublicationDto } from './dto/create-team-funnel-publication.dto';
import type { UpdateTeamFunnelPublicationDto } from './dto/update-team-funnel-publication.dto';
import type {
  FunnelPublication,
  FunnelPublicationRepository,
} from './interfaces/funnel-publication.interface';

@Injectable()
export class FunnelPublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(FUNNEL_PUBLICATION_REPOSITORY)
    private readonly repository?: FunnelPublicationRepository,
  ) {}

  createDraft(dto: CreateFunnelPublicationDto): FunnelPublication {
    return buildEntity<FunnelPublication>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      domainId: dto.domainId,
      funnelInstanceId: dto.funnelInstanceId,
      trackingProfileId: dto.trackingProfileId ?? null,
      handoffStrategyId: dto.handoffStrategyId ?? null,
      pathPrefix: dto.pathPrefix,
      status: 'draft',
      isPrimary: dto.isPrimary ?? false,
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
    domainId?: string;
  }): Promise<FunnelPublication[]> {
    if (!this.repository) {
      throw new Error(
        'FunnelPublicationRepository provider is not configured.',
      );
    }

    if (filters?.domainId) {
      return this.repository.findByDomainId(filters.domainId);
    }

    if (filters?.teamId) {
      return this.repository.findByTeamId(filters.teamId);
    }

    if (filters?.workspaceId) {
      return this.repository.findByWorkspaceId(filters.workspaceId);
    }

    return this.repository.findAll();
  }

  async createForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    dto: CreateTeamFunnelPublicationDto,
  ): Promise<FunnelPublication> {
    const pathPrefix = this.normalizePathPrefix(dto.pathPrefix);

    await this.assertPublicationDependencies(scope, {
      domainId: dto.domainId,
      funnelInstanceId: dto.funnelInstanceId,
      trackingProfileId: dto.trackingProfileId,
      handoffStrategyId: dto.handoffStrategyId,
      status: 'draft',
    });
    await this.assertPathConflict(dto.domainId, pathPrefix);

    const record = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.funnelPublication.updateMany({
          where: {
            domainId: dto.domainId,
            teamId: scope.teamId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.funnelPublication.create({
        data: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          domainId: dto.domainId,
          funnelInstanceId: dto.funnelInstanceId,
          trackingProfileId: dto.trackingProfileId ?? null,
          handoffStrategyId: dto.handoffStrategyId ?? null,
          pathPrefix,
          status: 'draft',
          isPrimary: dto.isPrimary ?? false,
        },
      });
    });

    return mapFunnelPublicationRecord(record);
  }

  async updateForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    funnelPublicationId: string,
    dto: UpdateTeamFunnelPublicationDto,
  ): Promise<FunnelPublication> {
    const existing = await this.prisma.funnelPublication.findFirst({
      where: {
        id: funnelPublicationId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'FUNNEL_PUBLICATION_NOT_FOUND',
        message: 'The requested publication was not found for this team.',
      });
    }

    const domainId = dto.domainId ?? existing.domainId;
    const funnelInstanceId = dto.funnelInstanceId ?? existing.funnelInstanceId;
    const pathPrefix =
      dto.pathPrefix !== undefined
        ? this.normalizePathPrefix(dto.pathPrefix)
        : existing.pathPrefix;
    const status = dto.status ?? existing.status;

    await this.assertPublicationDependencies(scope, {
      domainId,
      funnelInstanceId,
      trackingProfileId:
        dto.trackingProfileId !== undefined
          ? dto.trackingProfileId
          : existing.trackingProfileId,
      handoffStrategyId:
        dto.handoffStrategyId !== undefined
          ? dto.handoffStrategyId
          : existing.handoffStrategyId,
      status,
    });
    await this.assertPathConflict(domainId, pathPrefix, existing.id);

    const record = await this.prisma.$transaction(async (tx) => {
      const shouldBePrimary = dto.isPrimary ?? existing.isPrimary;

      if (shouldBePrimary) {
        await tx.funnelPublication.updateMany({
          where: {
            domainId,
            teamId: scope.teamId,
            isPrimary: true,
            NOT: { id: existing.id },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.funnelPublication.update({
        where: { id: existing.id },
        data: {
          domainId,
          funnelInstanceId,
          trackingProfileId:
            dto.trackingProfileId !== undefined
              ? dto.trackingProfileId
              : existing.trackingProfileId,
          handoffStrategyId:
            dto.handoffStrategyId !== undefined
              ? dto.handoffStrategyId
              : existing.handoffStrategyId,
          pathPrefix,
          status,
          isPrimary: shouldBePrimary,
        },
      });
    });

    return mapFunnelPublicationRecord(record);
  }

  private async assertPublicationDependencies(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    input: {
      domainId: string;
      funnelInstanceId: string;
      trackingProfileId?: string | null;
      handoffStrategyId?: string | null;
      status: 'draft' | 'active' | 'archived';
    },
  ) {
    const domain = await this.prisma.domain.findFirst({
      where: {
        id: input.domainId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
    });

    if (!domain) {
      throw new NotFoundException({
        code: 'DOMAIN_NOT_FOUND',
        message: 'The selected domain is not available for this team.',
      });
    }

    const funnelInstance = await this.prisma.funnelInstance.findFirst({
      where: {
        id: input.funnelInstanceId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
    });

    if (!funnelInstance) {
      throw new NotFoundException({
        code: 'FUNNEL_INSTANCE_NOT_FOUND',
        message: 'The selected funnel instance is not available for this team.',
      });
    }

    if (input.status === 'active') {
      if (domain.status !== 'active') {
        throw new ConflictException({
          code: 'DOMAIN_MUST_BE_ACTIVE',
          message: 'The publication can only be activated on an active domain.',
        });
      }

      if (funnelInstance.status !== 'active') {
        throw new ConflictException({
          code: 'FUNNEL_INSTANCE_MUST_BE_ACTIVE',
          message:
            'The publication can only be activated when the funnel instance is active.',
        });
      }
    }

    if (input.trackingProfileId) {
      const trackingProfile = await this.prisma.trackingProfile.findFirst({
        where: {
          id: input.trackingProfileId,
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
        },
        select: { id: true },
      });

      if (!trackingProfile) {
        throw new NotFoundException({
          code: 'TRACKING_PROFILE_NOT_FOUND',
          message:
            'The selected tracking profile is not available for this team.',
        });
      }
    }

    if (input.handoffStrategyId) {
      const handoffStrategy = await this.prisma.handoffStrategy.findFirst({
        where: {
          id: input.handoffStrategyId,
          workspaceId: scope.workspaceId,
          OR: [{ teamId: scope.teamId }, { teamId: null }],
        },
        select: { id: true },
      });

      if (!handoffStrategy) {
        throw new NotFoundException({
          code: 'HANDOFF_STRATEGY_NOT_FOUND',
          message:
            'The selected handoff strategy is not available for this team.',
        });
      }
    }
  }

  private async assertPathConflict(
    domainId: string,
    pathPrefix: string,
    excludePublicationId?: string,
  ) {
    const conflict = await this.prisma.funnelPublication.findFirst({
      where: {
        domainId,
        pathPrefix,
        ...(excludePublicationId
          ? {
              NOT: { id: excludePublicationId },
            }
          : {}),
      },
      include: {
        domain: {
          select: { host: true },
        },
      },
    });

    if (conflict) {
      throw new ConflictException({
        code: 'PUBLICATION_PATH_CONFLICT',
        message: `The path ${pathPrefix} is already in use on host ${conflict.domain.host}.`,
      });
    }
  }

  private normalizePathPrefix(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException({
        code: 'PATH_PREFIX_REQUIRED',
        message: 'A path prefix is required.',
      });
    }

    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const normalized =
      withLeadingSlash === '/' ? '/' : withLeadingSlash.replace(/\/+$/, '');

    return normalized || '/';
  }
}
