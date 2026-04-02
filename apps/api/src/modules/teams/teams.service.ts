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
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword } from '../auth/password-hash.util';
import { WalletEngineService } from '../finance/wallet-engine.service';
import { FunnelsService } from '../funnels/funnels.service';
import { buildEntity } from '../shared/domain.factory';
import { TEAM_REPOSITORY } from '../shared/domain.tokens';
import type { CreateTeamDto } from './dto/create-team.dto';
import type { ProvisionTenantDto } from './dto/provision-tenant.dto';
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

const toIso = (value: Date) => value.toISOString();

export type SystemTenantSummary = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
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

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletEngineService: WalletEngineService,
    private readonly funnelsService: FunnelsService,
    @Optional()
    @Inject(TEAM_REPOSITORY)
    private readonly repository?: TeamRepository,
  ) {}

  createDraft(dto: CreateTeamDto): Team {
    return buildEntity<Team>({
      workspaceId: dto.workspaceId,
      name: dto.name,
      code: dto.code,
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
    return `Leadflow-${randomBytes(9).toString('base64url')}`;
  }
}
