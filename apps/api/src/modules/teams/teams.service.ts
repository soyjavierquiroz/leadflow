import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { mapFunnelRecord } from '../../prisma/prisma.mappers';
import { hashPassword } from '../auth/password-hash.util';
import { WalletEngineService } from '../finance/wallet-engine.service';
import { FunnelsService } from '../funnels/funnels.service';
import { MailService } from '../mail/mail.service';
import { buildEntity } from '../shared/domain.factory';
import { TEAM_REPOSITORY } from '../shared/domain.tokens';
import type { JsonValue } from '../shared/domain.types';
import { assertSupportedFunnelBlocksJson } from '../shared/funnel-block-validation';
import type { CreateSystemTenantDto } from './dto/create-system-tenant.dto';
import type { CreateTeamDto } from './dto/create-team.dto';
import type { ProvisionTenantDto } from './dto/provision-tenant.dto';
import type { UpdateSystemTenantFunnelDto } from './dto/update-system-tenant-funnel.dto';
import type { UpdateSystemTenantFunnelStepDto } from './dto/update-system-tenant-funnel-step.dto';
import type { Team, TeamRepository } from './interfaces/team.interface';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const sanitizeRequiredText = (
  value: string | null | undefined,
  field: string,
) => {
  if (typeof value !== 'string') {
    throw new BadRequestException({
      code: 'FIELD_REQUIRED',
      message: `${field} is required.`,
      field,
    });
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new BadRequestException({
      code: 'FIELD_REQUIRED',
      message: `${field} is required.`,
      field,
    });
  }

  return trimmed;
};

const sanitizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

const funnelThemeIds = ['default', 'expert-secrets'] as const;
type FunnelThemeId = (typeof funnelThemeIds)[number];

const isJsonRecord = (
  value: JsonValue | null | undefined,
): value is Record<string, JsonValue> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isFunnelThemeId = (value: unknown): value is FunnelThemeId =>
  typeof value === 'string' &&
  (funnelThemeIds as readonly string[]).includes(value);

const toIso = (value: Date) => value.toISOString();
const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

export type SystemTenantSummary = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  managerUserId: string | null;
  name: string;
  code: string;
  status: string;
  isActive: boolean;
  subscriptionExpiresAt: string | null;
  maxSeats: number;
  occupiedSeats: number;
  activeSponsorsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SystemTenantDetail = SystemTenantSummary & {
  description: string | null;
  managerUserId: string | null;
  availableSeats: number;
  funnelCount: number;
  domainCount: number;
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: string;
    timezone: string;
    defaultCurrency: string;
    primaryLocale: string;
    primaryDomain: string | null;
  };
};

export type TeamSettingsSnapshot = {
  teamId: string;
  workspaceId: string;
  agencyName: string;
  teamCode: string;
  logoUrl: string | null;
  baseDomain: string | null;
  updatedAt: string;
};

export type SystemTenantFunnelStepSnapshot = {
  id: string;
  funnelInstanceId: string;
  slug: string;
  stepType: string;
  position: number;
  isEntryStep: boolean;
  isConversionStep: boolean;
  blocksJson: JsonValue;
  mediaMap: JsonValue;
  settingsJson: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type SystemTenantFunnelDetail = ReturnType<typeof mapFunnelRecord> & {
  funnelInstanceId: string | null;
  settingsJson: JsonValue;
  steps: SystemTenantFunnelStepSnapshot[];
};

export type SystemTenantFunnelStepMutationResult = {
  funnel: ReturnType<typeof mapFunnelRecord>;
  step: SystemTenantFunnelStepSnapshot;
};

export type SystemTenantFunnelStepHistoryEntry = {
  id: string;
  stepId: string;
  blocksJson: JsonValue;
  settingsJson: JsonValue;
  createdAt: string;
  createdBy: string | null;
};

type TeamScope = {
  workspaceId: string;
  teamId: string;
};

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly walletEngineService: WalletEngineService,
    private readonly funnelsService: FunnelsService,
    private readonly mailService: MailService,
    @Optional()
    @Inject(TEAM_REPOSITORY)
    private readonly repository?: TeamRepository,
  ) {}

  createDraft(dto: CreateTeamDto): Team {
    return buildEntity<Team>({
      workspaceId: dto.workspaceId,
      name: dto.name,
      code: dto.code,
      logoUrl: dto.logoUrl ?? null,
      status: 'draft',
      isActive: dto.isActive ?? true,
      subscriptionExpiresAt: dto.subscriptionExpiresAt ?? null,
      description: dto.description ?? null,
      managerUserId: dto.managerUserId ?? null,
      maxSeats: dto.maxSeats ?? 10,
      sponsorIds: [],
      funnelIds: [],
      domainIds: [],
      funnelInstanceIds: [],
      funnelPublicationIds: [],
      trackingProfileIds: [],
      handoffStrategyIds: [],
      rotationPoolIds: [],
    });
  }

  async list(filters?: { workspaceId?: string }): Promise<Team[]> {
    if (!this.repository) {
      throw new Error('TeamRepository provider is not configured.');
    }

    if (filters?.workspaceId) {
      return this.repository.findByWorkspaceId(filters.workspaceId);
    }

    return this.repository.findAll();
  }

  async getTeamSettings(scope: TeamScope): Promise<TeamSettingsSnapshot> {
    const record = await this.requireScopedTeam(scope);

    return this.mapTeamSettings(record);
  }

  async getTeamKredits(scope: TeamScope): Promise<{ balance: string }> {
    await this.requireScopedTeam(scope);

    const account = await this.walletEngineService.upsertAccount(scope.teamId);
    const balance = await this.walletEngineService.getSponsorKredits(
      account.accountId,
    );

    return { balance };
  }

  async updateTeamSettings(
    scope: TeamScope,
    dto: {
      agencyName?: string;
      logoUrl?: string | null;
      baseDomain?: string | null;
    },
  ): Promise<TeamSettingsSnapshot> {
    if (
      dto.agencyName === undefined &&
      dto.logoUrl === undefined &&
      dto.baseDomain === undefined
    ) {
      throw new BadRequestException({
        code: 'TEAM_SETTINGS_UPDATE_EMPTY',
        message: 'At least one team settings field is required.',
      });
    }

    const existing = await this.requireScopedTeam(scope);
    const agencyName =
      dto.agencyName === undefined
        ? existing.name
        : sanitizeRequiredText(dto.agencyName, 'agencyName');
    const logoUrl =
      dto.logoUrl === undefined
        ? existing.logoUrl
        : this.normalizeTeamLogoUrl(dto.logoUrl);
    const baseDomain =
      dto.baseDomain === undefined
        ? existing.workspace.primaryDomain
        : this.normalizeWorkspaceBaseDomain(dto.baseDomain);

    const updated = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.update({
        where: { id: existing.id },
        data: {
          name: agencyName,
          logoUrl,
        },
        include: {
          workspace: {
            select: {
              id: true,
              primaryDomain: true,
            },
          },
        },
      });

      if (baseDomain !== existing.workspace.primaryDomain) {
        await tx.workspace.update({
          where: { id: existing.workspaceId },
          data: {
            primaryDomain: baseDomain,
          },
        });

        team.workspace.primaryDomain = baseDomain;
      }

      return team;
    });

    return this.mapTeamSettings(updated);
  }

  async listSystemTenants(): Promise<SystemTenantSummary[]> {
    const records = await this.prisma.team.findMany({
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        sponsors: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return records.map((record) => ({
      id: record.id,
      workspaceId: record.workspaceId,
      workspaceName: record.workspace.name,
      workspaceSlug: record.workspace.slug,
      managerUserId: record.managerUserId,
      name: record.name,
      code: record.code,
      status: record.status,
      isActive: record.isActive,
      subscriptionExpiresAt: record.subscriptionExpiresAt
        ? toIso(record.subscriptionExpiresAt)
        : null,
      maxSeats: record.maxSeats,
      occupiedSeats: record.sponsors.length,
      activeSponsorsCount: record.sponsors.length,
      createdAt: toIso(record.createdAt),
      updatedAt: toIso(record.updatedAt),
    }));
  }

  async getSystemTenantDetail(id: string): Promise<SystemTenantDetail> {
    const tenantId = sanitizeRequiredText(id, 'id');

    const record = await this.prisma.team.findUnique({
      where: {
        id: tenantId,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            timezone: true,
            defaultCurrency: true,
            primaryLocale: true,
            primaryDomain: true,
          },
        },
        sponsors: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
          },
        },
        funnels: {
          where: {
            isTemplate: false,
          },
          select: {
            id: true,
          },
        },
        domains: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'The requested tenant was not found.',
      });
    }

    const occupiedSeats = record.sponsors.length;

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      workspaceName: record.workspace.name,
      workspaceSlug: record.workspace.slug,
      name: record.name,
      code: record.code,
      status: record.status,
      isActive: record.isActive,
      subscriptionExpiresAt: record.subscriptionExpiresAt
        ? toIso(record.subscriptionExpiresAt)
        : null,
      maxSeats: record.maxSeats,
      occupiedSeats,
      activeSponsorsCount: occupiedSeats,
      description: record.description,
      managerUserId: record.managerUserId,
      availableSeats: Math.max(record.maxSeats - occupiedSeats, 0),
      funnelCount: record.funnels.length,
      domainCount: record.domains.length,
      workspace: {
        id: record.workspace.id,
        name: record.workspace.name,
        slug: record.workspace.slug,
        status: record.workspace.status,
        timezone: record.workspace.timezone,
        defaultCurrency: record.workspace.defaultCurrency,
        primaryLocale: record.workspace.primaryLocale,
        primaryDomain: record.workspace.primaryDomain,
      },
      createdAt: toIso(record.createdAt),
      updatedAt: toIso(record.updatedAt),
    };
  }

  async listSystemTenantFunnels(id: string) {
    const tenantId = sanitizeRequiredText(id, 'id');
    await this.assertSystemTenantExists(tenantId);

    const records = await this.prisma.funnel.findMany({
      where: {
        defaultTeamId: tenantId,
        isTemplate: false,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return records.map(mapFunnelRecord);
  }

  async getSystemTenantFunnel(
    id: string,
    funnelId: string,
  ): Promise<SystemTenantFunnelDetail> {
    const tenantId = sanitizeRequiredText(id, 'id');
    const normalizedFunnelId = sanitizeRequiredText(funnelId, 'funnelId');

    await this.assertSystemTenantExists(tenantId);

    const existing = await this.requireSystemTenantFunnelRecord(
      tenantId,
      normalizedFunnelId,
    );
    const funnelInstance = await this.findPrimarySystemTenantFunnelInstance(
      tenantId,
      normalizedFunnelId,
    );

    return {
      ...mapFunnelRecord(existing),
      funnelInstanceId: funnelInstance?.id ?? null,
      settingsJson: this.cloneJsonValue(
        (funnelInstance?.settingsJson as JsonValue) ?? {},
      ),
      steps:
        funnelInstance?.steps.map((step) => this.mapSystemTenantFunnelStep(step)) ??
        [],
    };
  }

  async updateSystemTenantFunnel(
    id: string,
    funnelId: string,
    dto: UpdateSystemTenantFunnelDto,
  ) {
    const tenantId = sanitizeRequiredText(id, 'id');
    const normalizedFunnelId = sanitizeRequiredText(funnelId, 'funnelId');

    await this.assertSystemTenantExists(tenantId);

    const existing = await this.prisma.funnel.findFirst({
      where: {
        id: normalizedFunnelId,
        defaultTeamId: tenantId,
        isTemplate: false,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TENANT_FUNNEL_NOT_FOUND',
        message:
          'The requested funnel was not found for the selected tenant.',
      });
    }

    const name =
      dto.name === undefined
        ? existing.name
        : sanitizeRequiredText(dto.name, 'name');
    const description =
      dto.description === undefined
        ? existing.description
        : sanitizeOptionalText(dto.description);
    const nextConfig =
      dto.config === undefined
        ? this.cloneJsonValue(existing.config as JsonValue)
        : this.cloneJsonValue(dto.config);
    const funnelInstance = dto.funnelInstanceId
      ? await this.findSystemTenantFunnelInstanceById(
          tenantId,
          normalizedFunnelId,
          dto.funnelInstanceId,
        )
      : await this.findPrimarySystemTenantFunnelInstance(
          tenantId,
          normalizedFunnelId,
        );
    const settingsJson = this.mergeFunnelSettingsJson(
      (funnelInstance?.settingsJson as JsonValue) ?? {},
      dto.settingsJson,
      existing.config as JsonValue,
    );
    const config = this.mergeThemeIntoFunnelConfig(nextConfig, settingsJson);
    this.logger.log(
      `[theme-persist] updateSystemTenantFunnel funnel=${existing.id} instance=${
        funnelInstance?.id ?? 'none'
      } theme=${this.extractFunnelThemeFromRecord(settingsJson) ?? 'missing'}`,
    );

    const record = await this.prisma.$transaction(async (tx) => {
      const updatedFunnel = await tx.funnel.update({
        where: {
          id: existing.id,
        },
        data: {
          name,
          description,
          config: toInputJson(config),
        },
      });

      if (funnelInstance) {
        await tx.funnelInstance.update({
          where: {
            id: funnelInstance.id,
          },
          data: {
            settingsJson: toInputJson(settingsJson),
          },
        });
      }

      return updatedFunnel;
    });

    return mapFunnelRecord(record);
  }

  async updateSystemTenantFunnelStep(
    id: string,
    funnelId: string,
    stepId: string,
    dto: UpdateSystemTenantFunnelStepDto,
    createdBy: string | null = null,
  ): Promise<SystemTenantFunnelStepMutationResult> {
    const tenantId = sanitizeRequiredText(id, 'id');
    const normalizedFunnelId = sanitizeRequiredText(funnelId, 'funnelId');
    const normalizedStepId = sanitizeRequiredText(stepId, 'stepId');

    await this.assertSystemTenantExists(tenantId);

    const existingFunnel = await this.requireSystemTenantFunnelRecord(
      tenantId,
      normalizedFunnelId,
    );
    const existingStep = await this.prisma.funnelStep.findFirst({
      where: {
        id: normalizedStepId,
        teamId: tenantId,
        funnelInstance: {
          is: {
            teamId: tenantId,
            legacyFunnelId: normalizedFunnelId,
          },
        },
      },
    });

    if (!existingStep) {
      throw new NotFoundException({
        code: 'TENANT_FUNNEL_STEP_NOT_FOUND',
        message:
          'The requested funnel step was not found for the selected tenant funnel.',
      });
    }

    const name =
      dto.name === undefined
        ? existingFunnel.name
        : sanitizeRequiredText(dto.name, 'name');
    const description =
      dto.description === undefined
        ? existingFunnel.description
        : sanitizeOptionalText(dto.description);
    const blocksJson =
      dto.blocksJson === undefined
        ? this.cloneJsonValue(existingStep.blocksJson as JsonValue)
        : this.assertBlocksJson(this.cloneJsonValue(dto.blocksJson));
    const mediaMap =
      dto.mediaMap === undefined
        ? this.cloneJsonValue(existingStep.mediaMap as JsonValue)
        : this.cloneJsonValue(dto.mediaMap);
    const settingsJson =
      dto.settingsJson === undefined
        ? this.cloneJsonValue(existingStep.settingsJson as JsonValue)
        : this.cloneJsonValue(dto.settingsJson);

    const result = await this.prisma.$transaction(async (tx) => {
      const funnel = await tx.funnel.update({
        where: {
          id: existingFunnel.id,
        },
        data: {
          name,
          description,
        },
      });
      await this.snapshotSystemTenantStepHistory(
        tx,
        existingStep.id,
        existingStep.blocksJson as JsonValue,
        existingStep.settingsJson as JsonValue,
        createdBy,
      );
      const step = await tx.funnelStep.update({
        where: {
          id: existingStep.id,
        },
        data: {
          blocksJson: toInputJson(blocksJson),
          mediaMap: toInputJson(mediaMap),
          settingsJson: toInputJson(settingsJson),
        },
      });

      return { funnel, step };
    });

    return {
      funnel: mapFunnelRecord(result.funnel),
      step: this.mapSystemTenantFunnelStep(result.step),
    };
  }

  async listSystemTenantFunnelStepHistory(
    id: string,
    funnelId: string,
    stepId: string,
  ): Promise<SystemTenantFunnelStepHistoryEntry[]> {
    const tenantId = sanitizeRequiredText(id, 'id');
    const normalizedFunnelId = sanitizeRequiredText(funnelId, 'funnelId');
    const normalizedStepId = sanitizeRequiredText(stepId, 'stepId');

    await this.assertSystemTenantExists(tenantId);

    const step = await this.prisma.funnelStep.findFirst({
      where: {
        id: normalizedStepId,
        teamId: tenantId,
        funnelInstance: {
          is: {
            teamId: tenantId,
            legacyFunnelId: normalizedFunnelId,
          },
        },
      },
      include: {
        history: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 20,
        },
      },
    });

    if (!step) {
      throw new NotFoundException({
        code: 'TENANT_FUNNEL_STEP_NOT_FOUND',
        message:
          'The requested funnel step was not found for the selected tenant funnel.',
      });
    }

    return step.history.map((entry) => this.mapSystemTenantFunnelStepHistory(entry));
  }

  async createSystemTenant(dto: CreateSystemTenantDto) {
    const tenantName = sanitizeRequiredText(dto.tenantName, 'tenantName');
    const adminEmail = sanitizeRequiredText(
      dto.adminEmail,
      'adminEmail',
    ).toLowerCase();
    const adminFullName = this.deriveAdminFullName(adminEmail, tenantName);
    const response = await this.provisionTenant({
      workspaceName: tenantName,
      teamName: tenantName,
      adminFullName,
      adminEmail,
      sponsorDisplayName: adminFullName,
    });

    return {
      success: true as const,
      tenantId: response.team.id,
      workspaceId: response.workspace.id,
      adminUserId: response.adminUser.id,
    };
  }

  async provisionTenant(dto: ProvisionTenantDto) {
    const maxSeats = dto.maxSeats ?? 10;

    if (!Number.isInteger(maxSeats) || maxSeats < 1) {
      throw new BadRequestException({
        code: 'INVALID_MAX_SEATS',
        message: 'maxSeats must be an integer greater than or equal to 1.',
      });
    }

    const teamName = sanitizeRequiredText(
      dto.teamName ?? dto.workspaceName,
      'teamName',
    );
    const normalizedTeamCode =
      slugify(
        sanitizeRequiredText(
          dto.teamCode ?? dto.workspaceSlug ?? dto.teamName ?? dto.workspaceName,
          'teamCode',
        ),
      ) || null;

    if (!normalizedTeamCode) {
      throw new BadRequestException({
        code: 'INVALID_TEAM_CODE',
        message: 'teamCode must contain at least one alphanumeric character.',
      });
    }

    const adminFullName = sanitizeRequiredText(
      dto.adminFullName ?? dto.adminName,
      'adminFullName',
    );
    const adminEmail = sanitizeRequiredText(
      dto.adminEmail,
      'adminEmail',
    ).toLowerCase();
    const providedAdminPassword = sanitizeOptionalText(dto.adminPassword);
    const adminPassword =
      providedAdminPassword ?? this.generateTemporaryPassword();
    const adminRole = dto.adminRole ?? UserRole.TEAM_ADMIN;

    if (
      adminRole !== UserRole.TEAM_ADMIN &&
      adminRole !== UserRole.SUPER_ADMIN
    ) {
      throw new BadRequestException({
        code: 'INVALID_ADMIN_ROLE',
        message: 'adminRole must be TEAM_ADMIN or SUPER_ADMIN.',
      });
    }

    const workspaceId = sanitizeOptionalText(dto.workspaceId);
    const workspaceName = sanitizeOptionalText(dto.workspaceName);
    const workspaceSlugInput = sanitizeOptionalText(dto.workspaceSlug);
    const workspaceTimezone =
      sanitizeOptionalText(dto.workspaceTimezone) ?? 'UTC';
    const workspaceDefaultCurrency =
      sanitizeOptionalText(dto.workspaceDefaultCurrency) ?? 'USD';
    const workspacePrimaryLocale =
      sanitizeOptionalText(dto.workspacePrimaryLocale) ?? 'es';
    const workspacePrimaryDomain = sanitizeOptionalText(
      dto.workspacePrimaryDomain,
    );
    const workspaceSlug =
      workspaceId === null
        ? slugify(workspaceSlugInput ?? normalizedTeamCode) || null
        : null;
    const teamDescription = sanitizeOptionalText(dto.teamDescription);
    const sponsorDisplayName =
      sanitizeOptionalText(dto.sponsorDisplayName) ?? adminFullName;
    const sponsorEmail = sanitizeOptionalText(dto.sponsorEmail) ?? adminEmail;
    const sponsorPhone = sanitizeOptionalText(dto.sponsorPhone);
    const templateFunnelId = sanitizeOptionalText(dto.templateFunnelId);

    if (workspaceId === null && !workspaceName) {
      throw new BadRequestException({
        code: 'WORKSPACE_NAME_REQUIRED',
        message: 'workspaceName is required when workspaceId is not provided.',
      });
    }

    if (workspaceId === null && !workspaceSlug) {
      throw new BadRequestException({
        code: 'INVALID_WORKSPACE_SLUG',
        message:
          'workspaceSlug must contain at least one alphanumeric character when workspaceId is not provided.',
      });
    }

    if (templateFunnelId) {
      const template = await this.prisma.funnel.findFirst({
        where: {
          id: templateFunnelId,
          isTemplate: true,
          defaultTeamId: null,
        },
        select: { id: true },
      });

      if (!template) {
        throw new NotFoundException({
          code: 'FUNNEL_TEMPLATE_NOT_FOUND',
          message: 'The selected base funnel template was not found.',
        });
      }
    }

    try {
      const provisionedTenant = await this.prisma.$transaction(async (tx) => {
        const workspace =
          workspaceId !== null
            ? await tx.workspace.findUnique({
                where: {
                  id: workspaceId,
                },
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                  timezone: true,
                  defaultCurrency: true,
                  primaryLocale: true,
                  primaryDomain: true,
                },
              })
            : await tx.workspace.create({
                data: {
                  name: workspaceName!,
                  slug: workspaceSlug!,
                  status: 'active',
                  timezone: workspaceTimezone,
                  defaultCurrency: workspaceDefaultCurrency,
                  primaryLocale: workspacePrimaryLocale,
                  primaryDomain: workspacePrimaryDomain,
                },
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                  timezone: true,
                  defaultCurrency: true,
                  primaryLocale: true,
                  primaryDomain: true,
                },
              });

        if (!workspace) {
          throw new NotFoundException({
            code: 'WORKSPACE_NOT_FOUND',
            message: 'The requested workspace was not found.',
          });
        }

        const team = await tx.team.create({
          data: {
            workspaceId: workspace.id,
            name: teamName,
            code: normalizedTeamCode,
            status: 'active',
            isActive: true,
            subscriptionExpiresAt: null,
            description: teamDescription,
            maxSeats,
          },
          select: {
            id: true,
            workspaceId: true,
            name: true,
            code: true,
            status: true,
            isActive: true,
            subscriptionExpiresAt: true,
            description: true,
            managerUserId: true,
            maxSeats: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const adminUser = await tx.user.create({
          data: {
            workspaceId: workspace.id,
            teamId: team.id,
            fullName: adminFullName,
            email: adminEmail,
            passwordHash: hashPassword(adminPassword),
            role: adminRole,
            status: UserStatus.active,
          },
          select: {
            id: true,
            workspaceId: true,
            teamId: true,
            sponsorId: true,
            fullName: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const sponsor = await tx.sponsor.create({
          data: {
            workspaceId: workspace.id,
            teamId: team.id,
            displayName: sponsorDisplayName,
            status: 'active',
            isActive: true,
            email: sponsorEmail,
            phone: sponsorPhone,
            availabilityStatus: 'available',
            routingWeight: 1,
            memberPortalEnabled: true,
          },
          select: {
            id: true,
            workspaceId: true,
            teamId: true,
            displayName: true,
            status: true,
            isActive: true,
            email: true,
            phone: true,
            availabilityStatus: true,
            routingWeight: true,
            memberPortalEnabled: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const linkedAdminUser = await tx.user.update({
          where: {
            id: adminUser.id,
          },
          data: {
            sponsorId: sponsor.id,
          },
          select: {
            id: true,
            workspaceId: true,
            teamId: true,
            sponsorId: true,
            fullName: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const linkedTeam = await tx.team.update({
          where: {
            id: team.id,
          },
          data: {
            managerUserId: adminUser.id,
          },
          select: {
            id: true,
            workspaceId: true,
            name: true,
            code: true,
            status: true,
            isActive: true,
            subscriptionExpiresAt: true,
            description: true,
            managerUserId: true,
            maxSeats: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return {
          workspace,
          team: linkedTeam,
          adminUser: linkedAdminUser,
          sponsor,
          temporaryPassword: providedAdminPassword ? null : adminPassword,
          seatUsage: {
            maxSeats: linkedTeam.maxSeats,
            activeSeats: sponsor.isActive ? 1 : 0,
            availableSeats: linkedTeam.maxSeats - (sponsor.isActive ? 1 : 0),
          },
        };
      });

      if (templateFunnelId) {
        await this.funnelsService.cloneTemplateToTeam(
          templateFunnelId,
          provisionedTenant.team.id,
        );
      }

      try {
        await this.mailService.sendWelcomeEmail(
          provisionedTenant.adminUser.email,
          adminPassword,
          provisionedTenant.team.name,
        );
      } catch (error) {
        this.logger.error(
          `Team admin welcome email failed for ${provisionedTenant.adminUser.email}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
      void this.provisionSponsorWelcomeKredits(provisionedTenant.sponsor.id);

      return provisionedTenant;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(', ')
          : 'unique field';

        throw new ConflictException({
          code: 'PROVISION_TENANT_CONFLICT',
          message: `A record already exists for ${target}.`,
        });
      }

      throw error;
    }
  }

  private async provisionSponsorWelcomeKredits(sponsorId: string) {
    try {
      const account = await this.walletEngineService.upsertSponsorAccount(
        sponsorId,
      );

      await this.walletEngineService.creditInitialKredits(
        account.accountId,
        sponsorId,
      );
    } catch (error) {
      this.logger.error(
        `Sponsor ${sponsorId} wallet provisioning failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private generateTemporaryPassword() {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

    return Array.from(randomBytes(10), (byte) => alphabet[byte % alphabet.length])
      .join('')
      .slice(0, 10);
  }

  private deriveAdminFullName(email: string, teamName: string) {
    const localPart = sanitizeOptionalText(email.split('@')[0]);

    if (!localPart) {
      return `${teamName} Admin`;
    }

    const words = localPart
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map(
        (chunk: string) =>
          `${chunk[0]?.toUpperCase() ?? ''}${chunk.slice(1)}`,
      );

    if (words.length === 0) {
      return `${teamName} Admin`;
    }

    return words.join(' ');
  }

  private async requireScopedTeam(scope: TeamScope) {
    const record = await this.prisma.team.findFirst({
      where: {
        id: scope.teamId,
        workspaceId: scope.workspaceId,
      },
      include: {
        workspace: {
          select: {
            id: true,
            primaryDomain: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: 'The requested team was not found.',
      });
    }

    return record;
  }

  private mapTeamSettings(record: {
    id: string;
    workspaceId: string;
    name: string;
    code: string;
    logoUrl: string | null;
    updatedAt: Date;
    workspace: {
      id: string;
      primaryDomain: string | null;
    };
  }): TeamSettingsSnapshot {
    return {
      teamId: record.id,
      workspaceId: record.workspaceId,
      agencyName: record.name,
      teamCode: record.code,
      logoUrl: record.logoUrl,
      baseDomain: record.workspace.primaryDomain,
      updatedAt: toIso(record.updatedAt),
    };
  }

  private normalizeTeamLogoUrl(
    value: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
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
        code: 'TEAM_LOGO_URL_INVALID',
        message: 'logoUrl must be a valid absolute URL.',
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
            code: 'TEAM_LOGO_URL_INVALID_ORIGIN',
            message:
              'The team logo must point to the configured Leadflow CDN origin.',
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

  private normalizeWorkspaceBaseDomain(
    value: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim().toLowerCase();

    if (!trimmed) {
      return null;
    }

    let hostname = trimmed;

    if (trimmed.includes('://')) {
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(trimmed);
      } catch {
        throw new BadRequestException({
          code: 'WORKSPACE_BASE_DOMAIN_INVALID',
          message: 'baseDomain must be a valid hostname or URL.',
        });
      }

      if (
        parsedUrl.pathname !== '/' ||
        parsedUrl.search ||
        parsedUrl.hash ||
        parsedUrl.port
      ) {
        throw new BadRequestException({
          code: 'WORKSPACE_BASE_DOMAIN_INVALID',
          message:
            'baseDomain must only contain the hostname, without path, query or port.',
        });
      }

      hostname = parsedUrl.hostname.toLowerCase();
    }

    const normalizedHostname = hostname.replace(/\.$/, '');

    if (
      !/^(localhost|([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)$/.test(
        normalizedHostname,
      )
    ) {
      throw new BadRequestException({
        code: 'WORKSPACE_BASE_DOMAIN_INVALID',
        message: 'baseDomain must be a valid hostname.',
      });
    }

    return normalizedHostname;
  }

  private cloneJsonValue(value: JsonValue): JsonValue {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  }

  private assertBlocksJson(value: JsonValue) {
    return assertSupportedFunnelBlocksJson(value, {
      invalidArrayCode: 'TENANT_FUNNEL_STEP_BLOCKS_INVALID',
      invalidArrayMessage: 'The blocksJson payload must be a JSON array.',
      invalidBlockCode: 'TENANT_FUNNEL_STEP_BLOCK_TYPE_INVALID',
      field: 'blocksJson',
    });
  }

  private normalizeFunnelSettingsJson(value: JsonValue): JsonValue {
    if (!isJsonRecord(value)) {
      throw new BadRequestException({
        code: 'TENANT_FUNNEL_SETTINGS_INVALID',
        message: 'settingsJson must be a JSON object.',
      });
    }

    const themeValue = value.theme;
    if (themeValue === undefined || themeValue === null) {
      return {
        ...value,
      };
    }

    if (!isFunnelThemeId(themeValue)) {
      throw new BadRequestException({
        code: 'TENANT_FUNNEL_THEME_INVALID',
        message: `theme must be one of: ${funnelThemeIds.join(', ')}.`,
      });
    }

    return {
      ...value,
      theme: themeValue,
    };
  }

  private mergeFunnelSettingsJson(
    existingSettingsJson: JsonValue | null | undefined,
    incomingSettingsJson: JsonValue | undefined,
    legacyConfig: JsonValue | null | undefined,
  ): JsonValue {
    const safeExisting = isJsonRecord(existingSettingsJson)
      ? this.cloneJsonValue(existingSettingsJson)
      : {};
    const safeIncoming =
      incomingSettingsJson === undefined
        ? {}
        : this.normalizeFunnelSettingsJson(incomingSettingsJson);
    const mergedSettings = {
      ...(isJsonRecord(safeExisting) ? safeExisting : {}),
      ...(isJsonRecord(safeIncoming) ? safeIncoming : {}),
    } satisfies Record<string, JsonValue>;
    const resolvedTheme =
      this.extractFunnelThemeFromRecord(mergedSettings) ??
      this.extractFunnelThemeFromRecord(legacyConfig);

    return resolvedTheme
      ? {
          ...mergedSettings,
          theme: resolvedTheme,
        }
      : mergedSettings;
  }

  private mergeThemeIntoFunnelConfig(
    config: JsonValue,
    settingsJson: JsonValue,
  ): JsonValue {
    if (!isJsonRecord(config)) {
      return config;
    }

    const theme = this.extractFunnelThemeFromRecord(settingsJson);
    if (!theme) {
      return {
        ...config,
      };
    }

    return {
      ...config,
      theme,
    };
  }

  private extractFunnelThemeFromRecord(
    value: JsonValue | null | undefined,
  ): FunnelThemeId | null {
    if (!isJsonRecord(value)) {
      return null;
    }

    return isFunnelThemeId(value.theme) ? value.theme : null;
  }

  private mapSystemTenantFunnelStep(step: {
    id: string;
    funnelInstanceId: string;
    slug: string;
    stepType: string;
    position: number;
    isEntryStep: boolean;
    isConversionStep: boolean;
    blocksJson: unknown;
    mediaMap: unknown;
    settingsJson: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): SystemTenantFunnelStepSnapshot {
    return {
      id: step.id,
      funnelInstanceId: step.funnelInstanceId,
      slug: step.slug,
      stepType: step.stepType,
      position: step.position,
      isEntryStep: step.isEntryStep,
      isConversionStep: step.isConversionStep,
      blocksJson: this.cloneJsonValue(step.blocksJson as JsonValue),
      mediaMap: this.cloneJsonValue(step.mediaMap as JsonValue),
      settingsJson: this.cloneJsonValue(step.settingsJson as JsonValue),
      createdAt: toIso(step.createdAt),
      updatedAt: toIso(step.updatedAt),
    };
  }

  private mapSystemTenantFunnelStepHistory(entry: {
    id: string;
    stepId: string;
    blocksJson: unknown;
    settingsJson: unknown;
    createdAt: Date;
    createdBy: string | null;
  }): SystemTenantFunnelStepHistoryEntry {
    return {
      id: entry.id,
      stepId: entry.stepId,
      blocksJson: this.cloneJsonValue(entry.blocksJson as JsonValue),
      settingsJson: this.cloneJsonValue(entry.settingsJson as JsonValue),
      createdAt: toIso(entry.createdAt),
      createdBy: entry.createdBy,
    };
  }

  private async snapshotSystemTenantStepHistory(
    tx: Prisma.TransactionClient,
    stepId: string,
    blocksJson: JsonValue,
    settingsJson: JsonValue,
    createdBy: string | null,
  ) {
    await tx.funnelStepHistory.create({
      data: {
        stepId,
        blocksJson: toInputJson(blocksJson),
        settingsJson: toInputJson(settingsJson),
        createdBy,
      },
    });

    const obsoleteVersions = await tx.funnelStepHistory.findMany({
      where: { stepId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 20,
      select: { id: true },
    });

    if (obsoleteVersions.length === 0) {
      return;
    }

    await tx.funnelStepHistory.deleteMany({
      where: {
        id: {
          in: obsoleteVersions.map((entry) => entry.id),
        },
      },
    });
  }

  private async requireSystemTenantFunnelRecord(tenantId: string, funnelId: string) {
    const existing = await this.prisma.funnel.findFirst({
      where: {
        id: funnelId,
        defaultTeamId: tenantId,
        isTemplate: false,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TENANT_FUNNEL_NOT_FOUND',
        message:
          'The requested funnel was not found for the selected tenant.',
      });
    }

    return existing;
  }

  private async findPrimarySystemTenantFunnelInstance(
    tenantId: string,
    funnelId: string,
  ) {
    const instances = await this.prisma.funnelInstance.findMany({
      where: {
        teamId: tenantId,
        legacyFunnelId: funnelId,
      },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return [...instances].sort((left, right) => {
      if ((left.status === 'active') !== (right.status === 'active')) {
        return left.status === 'active' ? -1 : 1;
      }

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    })[0] ?? null;
  }

  private async findSystemTenantFunnelInstanceById(
    tenantId: string,
    funnelId: string,
    funnelInstanceId: string,
  ) {
    const normalizedFunnelInstanceId = sanitizeRequiredText(
      funnelInstanceId,
      'funnelInstanceId',
    );
    const funnelInstance = await this.prisma.funnelInstance.findFirst({
      where: {
        id: normalizedFunnelInstanceId,
        teamId: tenantId,
        legacyFunnelId: funnelId,
      },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!funnelInstance) {
      throw new NotFoundException({
        code: 'TENANT_FUNNEL_INSTANCE_NOT_FOUND',
        message:
          'The requested funnel instance was not found for the selected tenant funnel.',
      });
    }

    return funnelInstance;
  }

  private async assertSystemTenantExists(id: string) {
    const tenant = await this.prisma.team.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'The requested tenant was not found.',
      });
    }
  }
}
