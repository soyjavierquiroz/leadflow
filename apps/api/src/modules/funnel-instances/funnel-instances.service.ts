import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { buildEntity } from '../shared/domain.factory';
import { FUNNEL_INSTANCE_REPOSITORY } from '../shared/domain.tokens';
import {
  funnelInstanceInclude,
  mapFunnelInstanceRecord,
} from '../../prisma/prisma.mappers';
import { PrismaService } from '../../prisma/prisma.service';
import { RuntimeContextConfigSyncService } from '../runtime-context/runtime-context-config-sync.service';
import type { CreateFunnelInstanceDto } from './dto/create-funnel-instance.dto';
import type { CreateTeamFunnelInstanceDto } from './dto/create-team-funnel-instance.dto';
import type { UpdateTeamFunnelInstanceDto } from './dto/update-team-funnel-instance.dto';
import type {
  FunnelInstance,
  FunnelInstanceRepository,
} from './interfaces/funnel-instance.interface';

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

@Injectable()
export class FunnelInstancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly runtimeContextConfigSyncService: RuntimeContextConfigSyncService,
    @Optional()
    @Inject(FUNNEL_INSTANCE_REPOSITORY)
    private readonly repository?: FunnelInstanceRepository,
  ) {}

  createDraft(dto: CreateFunnelInstanceDto): FunnelInstance {
    return buildEntity<FunnelInstance>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      templateId: dto.templateId,
      legacyFunnelId: dto.legacyFunnelId ?? null,
      name: dto.name,
      code: dto.code,
      thumbnailUrl: null,
      status: 'draft',
      structuralType: 'generic',
      conversionContract: {},
      rotationPoolId: dto.rotationPoolId ?? null,
      trackingProfileId: dto.trackingProfileId ?? null,
      handoffStrategyId: dto.handoffStrategyId ?? null,
      settingsJson: dto.settingsJson,
      mediaMap: dto.mediaMap,
      stepIds: [],
      publicationIds: [],
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
  }): Promise<FunnelInstance[]> {
    if (!this.repository) {
      throw new Error('FunnelInstanceRepository provider is not configured.');
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
    dto: CreateTeamFunnelInstanceDto,
  ): Promise<FunnelInstance> {
    const name = dto.name.trim();
    const code = this.normalizeCode(dto.code);

    if (!name) {
      throw new BadRequestException({
        code: 'FUNNEL_INSTANCE_NAME_REQUIRED',
        message: 'A funnel instance name is required.',
      });
    }

    const template = await this.prisma.funnelTemplate.findFirst({
      where: {
        id: dto.templateId,
        status: {
          in: ['active', 'draft'],
        },
        OR: [{ workspaceId: scope.workspaceId }, { workspaceId: null }],
      },
    });

    if (!template) {
      throw new NotFoundException({
        code: 'FUNNEL_TEMPLATE_NOT_FOUND',
        message: 'The selected funnel template is not available for this team.',
      });
    }

    await this.assertTeamScopedDependencies(scope, {
      rotationPoolId: dto.rotationPoolId,
      trackingProfileId: dto.trackingProfileId,
      handoffStrategyId: dto.handoffStrategyId,
    });

    const duplicate = await this.prisma.funnelInstance.findFirst({
      where: {
        teamId: scope.teamId,
        code,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException({
        code: 'FUNNEL_INSTANCE_CODE_CONFLICT',
        message: 'Another funnel instance already uses this code in the team.',
      });
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const legacyFunnel = await tx.funnel.create({
        data: {
          workspaceId: scope.workspaceId,
          name,
          code,
          thumbnailUrl: null,
          status: 'draft',
          stages: ['captured', 'qualified', 'assigned'],
          entrySources: ['manual', 'form', 'landing_page', 'api'],
          defaultTeamId: scope.teamId,
          defaultRotationPoolId: dto.rotationPoolId ?? null,
        },
      });

      return tx.funnelInstance.create({
        data: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          templateId: template.id,
          legacyFunnelId: legacyFunnel.id,
          name,
          code,
          thumbnailUrl: null,
          status: 'draft',
          rotationPoolId: dto.rotationPoolId ?? null,
          trackingProfileId: dto.trackingProfileId ?? null,
          handoffStrategyId: dto.handoffStrategyId ?? null,
          settingsJson: toInputJson(template.settingsJson),
          mediaMap: toInputJson(template.mediaMap),
        },
        include: funnelInstanceInclude,
      });
    });

    return mapFunnelInstanceRecord(record);
  }

  async updateForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    funnelInstanceId: string,
    dto: UpdateTeamFunnelInstanceDto,
  ): Promise<FunnelInstance> {
    const existing = await this.prisma.funnelInstance.findFirst({
      where: {
        id: funnelInstanceId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      include: funnelInstanceInclude,
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'FUNNEL_INSTANCE_NOT_FOUND',
        message: 'The requested funnel instance was not found for this team.',
      });
    }

    const name = dto.name !== undefined ? dto.name.trim() : existing.name;
    const code =
      dto.code !== undefined ? this.normalizeCode(dto.code) : existing.code;
    const thumbnailUrl =
      dto.thumbnailUrl !== undefined
        ? this.normalizeAssetUrl(dto.thumbnailUrl)
        : existing.thumbnailUrl;
    const status = dto.status ?? existing.status;
    const structuralType = dto.structuralType ?? existing.structuralType;
    const conversionContract =
      dto.conversionContract !== undefined
        ? dto.conversionContract
        : existing.conversionContract;

    if (!name) {
      throw new BadRequestException({
        code: 'FUNNEL_INSTANCE_NAME_REQUIRED',
        message: 'A funnel instance name is required.',
      });
    }

    if (
      code !== existing.code &&
      (await this.prisma.funnelInstance.findFirst({
        where: {
          teamId: scope.teamId,
          code,
          NOT: { id: existing.id },
        },
        select: { id: true },
      }))
    ) {
      throw new ConflictException({
        code: 'FUNNEL_INSTANCE_CODE_CONFLICT',
        message: 'Another funnel instance already uses this code in the team.',
      });
    }

    await this.assertTeamScopedDependencies(scope, {
      rotationPoolId: dto.rotationPoolId,
      trackingProfileId: dto.trackingProfileId,
      handoffStrategyId: dto.handoffStrategyId,
    });

    const record = await this.prisma.$transaction(async (tx) => {
      if (existing.legacyFunnelId) {
        await tx.funnel.update({
          where: { id: existing.legacyFunnelId },
          data: {
            name,
            code,
            thumbnailUrl,
            status,
            defaultTeamId: scope.teamId,
            defaultRotationPoolId:
              dto.rotationPoolId !== undefined
                ? dto.rotationPoolId
                : existing.rotationPoolId,
          },
        });
      }

      return tx.funnelInstance.update({
        where: { id: existing.id },
        data: {
          name,
          code,
          thumbnailUrl,
          status,
          structuralType,
          conversionContract: toInputJson(conversionContract),
          rotationPoolId:
            dto.rotationPoolId !== undefined
              ? dto.rotationPoolId
              : existing.rotationPoolId,
          trackingProfileId:
            dto.trackingProfileId !== undefined
              ? dto.trackingProfileId
              : existing.trackingProfileId,
          handoffStrategyId:
            dto.handoffStrategyId !== undefined
              ? dto.handoffStrategyId
              : existing.handoffStrategyId,
        },
        include: funnelInstanceInclude,
      });
    });

    await this.runtimeContextConfigSyncService.syncFunnelContextForInstance({
      tenantId: scope.teamId,
      funnelInstanceId: record.id,
    });

    return mapFunnelInstanceRecord(record);
  }

  private normalizeAssetUrl(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(trimmed);
    } catch {
      throw new BadRequestException({
        code: 'FUNNEL_INSTANCE_THUMBNAIL_URL_INVALID',
        message: 'Thumbnail URL must be a valid absolute URL.',
      });
    }

    const configuredBaseUrl = this.configService
      .get<string>('MINIO_PUBLIC_URL')
      ?.trim();

    if (configuredBaseUrl) {
      try {
        const publicBaseUrl = new URL(configuredBaseUrl);

        if (parsedUrl.origin !== publicBaseUrl.origin) {
          throw new BadRequestException({
            code: 'FUNNEL_INSTANCE_THUMBNAIL_URL_INVALID_ORIGIN',
            message:
              'Thumbnail URL must point to the configured Leadflow CDN origin.',
          });
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
      }
    }

    return parsedUrl.toString();
  }

  private async assertTeamScopedDependencies(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    input: {
      rotationPoolId?: string | null;
      trackingProfileId?: string | null;
      handoffStrategyId?: string | null;
    },
  ) {
    if (input.rotationPoolId) {
      const pool = await this.prisma.rotationPool.findFirst({
        where: {
          id: input.rotationPoolId,
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
        },
        select: { id: true },
      });

      if (!pool) {
        throw new NotFoundException({
          code: 'ROTATION_POOL_NOT_FOUND',
          message: 'The selected rotation pool is not available for this team.',
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

  private normalizeCode(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!normalized) {
      throw new BadRequestException({
        code: 'FUNNEL_INSTANCE_CODE_REQUIRED',
        message: 'A valid funnel instance code is required.',
      });
    }

    return normalized;
  }
}
