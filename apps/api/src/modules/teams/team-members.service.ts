import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword } from '../auth/password-hash.util';
import { WalletEngineService } from '../finance/wallet-engine.service';
import { MailerService } from '../shared/mailer.service';
import type { CreateTeamMemberDto } from './dto/create-team-member.dto';
import type { UpdateTeamMemberStatusDto } from './dto/update-team-member-status.dto';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const shouldKeepLoginEnabled = (role: UserRole) =>
  role === UserRole.TEAM_ADMIN || role === UserRole.SUPER_ADMIN;

type TeamMemberScope = {
  workspaceId: string;
  teamId: string;
};

type TeamSeatSummary = {
  teamId: string;
  teamName: string;
  maxSeats: number;
  activeSeats: number;
  availableSeats: number;
};

export type TeamMemberRecord = {
  id: string;
  userId: string;
  sponsorId: string | null;
  fullName: string;
  displayName: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  userStatus: UserStatus;
  sponsorStatus: string | null;
  availabilityStatus: string | null;
  isActive: boolean;
  memberPortalEnabled: boolean;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamMembersSnapshot = {
  team: TeamSeatSummary;
  members: TeamMemberRecord[];
};

export type TeamMemberMutationResult = {
  team: TeamSeatSummary;
  member: TeamMemberRecord;
};

export type TeamMemberInvitationResult = TeamMemberMutationResult & {
  temporaryPassword: string;
};

export type TeamMemberDeletionResult = {
  team: TeamSeatSummary;
  deletedMemberId: string;
};

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

const sanitizeRequiredEmail = (value: string | null | undefined) => {
  const normalized = sanitizeRequiredText(value, 'email').toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new BadRequestException({
      code: 'TEAM_MEMBER_EMAIL_INVALID',
      message: 'email must be a valid email address.',
      field: 'email',
    });
  }

  return normalized;
};

const sanitizeRequiredWhatsappNumber = (value: string | null | undefined) => {
  const normalized = sanitizeRequiredText(value, 'whatsappNumber');
  const digits = normalized.replace(/\D+/g, '');

  if (!/^[+0-9()\-\s]+$/.test(normalized) || digits.length < 8) {
    throw new BadRequestException({
      code: 'TEAM_MEMBER_WHATSAPP_INVALID',
      message:
        'whatsappNumber must be a valid WhatsApp number with at least 8 digits.',
      field: 'whatsappNumber',
    });
  }

  if (digits.length > 15) {
    throw new BadRequestException({
      code: 'TEAM_MEMBER_WHATSAPP_INVALID',
      message:
        'whatsappNumber must contain no more than 15 digits after normalization.',
      field: 'whatsappNumber',
    });
  }

  return normalized;
};

const toIso = (value: Date | null) => (value ? value.toISOString() : null);

const teamMemberInclude = {
  sponsor: true,
} satisfies Prisma.UserInclude;

type TeamMemberUserRecord = Prisma.UserGetPayload<{
  include: typeof teamMemberInclude;
}>;

const legacyPermissionTableNames = ['service_permissions', 'ServicePermission'];
const legacyPermissionColumnNames = [
  'user_id',
  'userId',
  'sponsor_id',
  'sponsorId',
  'member_id',
  'memberId',
  'advisor_id',
  'advisorId',
];

type LegacyPermissionColumn = {
  tableName: string;
  columnName: string;
};

@Injectable()
export class TeamMembersService {
  private readonly logger = new Logger(TeamMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletEngineService: WalletEngineService,
    private readonly mailerService: MailerService,
  ) {}

  async list(scope: TeamMemberScope): Promise<TeamMembersSnapshot> {
    await this.reconcileOperationalTeamAdmins(scope);

    const [team, members] = await Promise.all([
      this.requireTeam(scope),
      this.prisma.user.findMany({
        where: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
        },
        include: teamMemberInclude,
        orderBy: [{ createdAt: 'asc' }],
      }),
    ]);

    const activeSeats = await this.countActiveSeats(scope);

    return {
      team: this.buildSeatSummary(team, activeSeats),
      members: members
        .map((member) => this.mapTeamMember(member))
        .sort((left, right) => this.compareMembers(left, right)),
    };
  }

  async getSeatSummary(scope: TeamMemberScope): Promise<TeamSeatSummary> {
    const [team, activeSeats] = await Promise.all([
      this.requireTeam(scope),
      this.countActiveSeats(scope),
    ]);

    return this.buildSeatSummary(team, activeSeats);
  }

  async updateStatus(
    scope: TeamMemberScope,
    memberId: string,
    dto: UpdateTeamMemberStatusDto,
  ): Promise<TeamMemberMutationResult> {
    if (typeof dto.isActive !== 'boolean') {
      throw new BadRequestException({
        code: 'TEAM_MEMBER_STATUS_REQUIRED',
        message: 'isActive must be provided as a boolean value.',
      });
    }

    await this.ensureOperationalTeamAdminSponsor(scope, memberId);

    const mutation = await this.prisma.$transaction(
      async (tx) => {
        await this.lockTeamSeatCounter(scope, tx);

        const member = await tx.user.findFirst({
          where: {
            id: memberId,
            workspaceId: scope.workspaceId,
            teamId: scope.teamId,
          },
          include: teamMemberInclude,
        });

        if (!member) {
          throw new NotFoundException({
            code: 'TEAM_MEMBER_NOT_FOUND',
            message: 'The requested team member was not found.',
          });
        }

        if (!member.sponsor) {
          throw new ConflictException({
            code: 'TEAM_MEMBER_SPONSOR_MISSING',
            message:
              'The requested team member does not have an operational sponsor profile.',
          });
        }

        const team = await this.requireTeam(scope, tx);
        const shouldActivate = dto.isActive && !member.sponsor.isActive;

        if (shouldActivate) {
          await this.assertSeatAvailability(
            scope,
            team.maxSeats,
            tx,
            member.sponsor.id,
          );
        }

        const sponsor = await tx.sponsor.update({
          where: {
            id: member.sponsor.id,
          },
          data: {
            isActive: dto.isActive,
          },
        });
        const nextUserStatus = shouldKeepLoginEnabled(member.role)
          ? UserStatus.active
          : dto.isActive
            ? UserStatus.active
            : UserStatus.disabled;

        const user = await tx.user.update({
          where: {
            id: member.id,
          },
          data: {
            status: nextUserStatus,
          },
        });

        const activeSeats = await this.countActiveSeats(scope, tx);

        return {
          team: this.buildSeatSummary(team, activeSeats),
          member: this.mapTeamMember({
            ...member,
            status: user.status,
            sponsor,
          }),
          activationEmail:
            shouldActivate && member.email
              ? {
                  email: member.email,
                  teamName: team.name,
                  publicSlug: sponsor.publicSlug,
                }
              : null,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    if (mutation.activationEmail) {
      void this.dispatchAdvisorActivationEmail({
        email: mutation.activationEmail.email,
        teamName: mutation.activationEmail.teamName,
        publicSlug: mutation.activationEmail.publicSlug,
      });
    }

    return {
      team: mutation.team,
      member: mutation.member,
    };
  }

  async invite(
    scope: TeamMemberScope,
    dto: CreateTeamMemberDto,
  ): Promise<TeamMemberInvitationResult> {
    const fullName = sanitizeRequiredText(dto.fullName, 'fullName');
    const email = sanitizeRequiredEmail(dto.email);
    const whatsappNumber = sanitizeRequiredWhatsappNumber(dto.whatsappNumber);
    const temporaryPassword = this.generateTemporaryPassword();

    if (dto.isActive === true) {
      throw new BadRequestException({
        code: 'TEAM_MEMBER_INVITATION_MUST_START_INACTIVE',
        message:
          'New advisors must be created as inactive. Use the activation endpoint after the invitation is created.',
      });
    }

    const invitation = await this.prisma.$transaction(async (tx) => {
      const team = await this.requireTeam(scope, tx);

      const existingUser = await tx.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

      if (existingUser) {
        throw new ConflictException({
          code: 'TEAM_MEMBER_EMAIL_TAKEN',
          message: 'A user with this email already exists.',
        });
      }

      const user = await tx.user.create({
        data: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          fullName,
          email,
          passwordHash: hashPassword(temporaryPassword),
          role: UserRole.MEMBER,
          status: UserStatus.disabled,
        },
        include: teamMemberInclude,
      });

      const sponsor = await tx.sponsor.create({
        data: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          displayName: fullName,
          publicSlug: await this.generateAvailablePublicSlug(tx, fullName),
          status: 'active',
          isActive: false,
          email,
          phone: whatsappNumber,
          availabilityStatus: 'available',
          routingWeight: 1,
          memberPortalEnabled: true,
        },
      });

      const linkedUser = await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          sponsorId: sponsor.id,
        },
        include: teamMemberInclude,
      });

      const activeSeats = await this.countActiveSeats(scope, tx);

      return {
        team: this.buildSeatSummary(team, activeSeats),
        member: this.mapTeamMember(linkedUser),
        temporaryPassword,
        welcomeEmail: {
          email,
          teamName: team.name,
        },
      };
    });

    if (invitation.member.sponsorId) {
      void this.provisionSponsorWelcomeKredits(invitation.member.sponsorId);
    }

    void this.dispatchAdvisorWelcomeEmail({
      email: invitation.welcomeEmail.email,
      temporaryPassword: invitation.temporaryPassword,
      teamName: invitation.welcomeEmail.teamName,
    });

    return {
      team: invitation.team,
      member: invitation.member,
      temporaryPassword: invitation.temporaryPassword,
    };
  }

  async remove(
    scope: TeamMemberScope,
    memberId: string,
  ): Promise<TeamMemberDeletionResult> {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.user.findFirst({
        where: {
          id: memberId,
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
        },
        include: teamMemberInclude,
      });

      if (!member) {
        throw new NotFoundException({
          code: 'TEAM_MEMBER_NOT_FOUND',
          message: 'The requested team member was not found.',
        });
      }

      if (member.role !== UserRole.MEMBER) {
        throw new BadRequestException({
          code: 'TEAM_MEMBER_DELETE_FORBIDDEN',
          message:
            'Only advisor accounts with MEMBER role can be deleted from this panel.',
        });
      }

      const team = await this.requireTeam(scope, tx);
      const sponsorId = member.sponsor?.id ?? null;

      await this.deleteLegacyServicePermissions(tx, {
        userId: member.id,
        sponsorId,
      });

      await tx.team.updateMany({
        where: {
          id: scope.teamId,
          workspaceId: scope.workspaceId,
          lastAssignedUserId: member.id,
        },
        data: {
          lastAssignedUserId: null,
        },
      });

      await tx.authSession.deleteMany({
        where: {
          userId: member.id,
        },
      });

      await tx.user.delete({
        where: {
          id: member.id,
        },
      });

      if (sponsorId) {
        await tx.sponsor.delete({
          where: {
            id: sponsorId,
          },
        });
      }

      const activeSeats = await this.countActiveSeats(scope, tx);

      return {
        team: this.buildSeatSummary(team, activeSeats),
        deletedMemberId: member.id,
      };
    });
  }

  private async requireTeam(
    scope: TeamMemberScope,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const team = await tx.team.findFirst({
      where: {
        id: scope.teamId,
        workspaceId: scope.workspaceId,
      },
      select: {
        id: true,
        name: true,
        maxSeats: true,
      },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: 'The requested team was not found.',
      });
    }

    return team;
  }

  private async countActiveSeats(
    scope: TeamMemberScope,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
    excludedSponsorId?: string,
  ) {
    return tx.sponsor.count({
      where: {
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        isActive: true,
        user: {
          is: {
            role: {
              in: [UserRole.MEMBER, UserRole.TEAM_ADMIN],
            },
          },
        },
        ...(excludedSponsorId
          ? {
              id: {
                not: excludedSponsorId,
              },
            }
          : {}),
      },
    });
  }

  private async assertSeatAvailability(
    scope: TeamMemberScope,
    maxSeats: number,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
    excludedSponsorId?: string,
  ) {
    const activeSeats = await this.countActiveSeats(
      scope,
      tx,
      excludedSponsorId,
    );

    if (activeSeats >= maxSeats) {
      throw new ConflictException({
        code: 'TEAM_SEAT_LIMIT_REACHED',
        message: 'Límite de licencias alcanzado',
        details: {
          maxSeats,
          activeSeats,
          requiresMemberExemption: false,
        },
      });
    }
  }

  private async lockTeamSeatCounter(
    scope: TeamMemberScope,
    tx: Prisma.TransactionClient,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Team"
      WHERE "id" = ${scope.teamId}
        AND "workspaceId" = ${scope.workspaceId}
      FOR UPDATE
    `);

    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: 'The requested team was not found.',
      });
    }
  }

  private buildSeatSummary(
    team: {
      id: string;
      name: string;
      maxSeats: number;
    },
    activeSeats: number,
  ): TeamSeatSummary {
    return {
      teamId: team.id,
      teamName: team.name,
      maxSeats: team.maxSeats,
      activeSeats,
      availableSeats: Math.max(team.maxSeats - activeSeats, 0),
    };
  }

  private mapTeamMember(member: TeamMemberUserRecord): TeamMemberRecord {
    return {
      id: member.id,
      userId: member.id,
      sponsorId: member.sponsor?.id ?? null,
      fullName: member.fullName,
      displayName: member.sponsor?.displayName ?? null,
      email: member.email,
      phone: member.sponsor?.phone ?? null,
      role: member.role,
      userStatus: member.status,
      sponsorStatus: member.sponsor?.status ?? null,
      availabilityStatus: member.sponsor?.availabilityStatus ?? null,
      isActive: member.sponsor?.isActive ?? false,
      memberPortalEnabled: member.sponsor?.memberPortalEnabled ?? false,
      avatarUrl: member.sponsor?.avatarUrl ?? null,
      lastLoginAt: toIso(member.lastLoginAt),
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }

  private compareMembers(left: TeamMemberRecord, right: TeamMemberRecord) {
    const leftPriority = this.resolveRolePriority(left.role);
    const rightPriority = this.resolveRolePriority(right.role);

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.createdAt.localeCompare(right.createdAt);
  }

  private resolveRolePriority(role: UserRole) {
    switch (role) {
      case UserRole.TEAM_ADMIN:
        return 0;
      case UserRole.MEMBER:
        return 1;
      case UserRole.SUPER_ADMIN:
        return 2;
    }
  }

  private generateTemporaryPassword() {
    return `Leadflow-${randomBytes(9).toString('base64url')}`;
  }

  private async deleteLegacyServicePermissions(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      sponsorId: string | null;
    },
  ) {
    const targetIds = [input.userId, input.sponsorId].filter(
      (value): value is string => Boolean(value),
    );

    if (targetIds.length === 0) {
      return;
    }

    const columns = await tx.$queryRaw<LegacyPermissionColumn[]>(Prisma.sql`
      SELECT
        table_name AS "tableName",
        column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (${Prisma.join(legacyPermissionTableNames)})
        AND column_name IN (${Prisma.join(legacyPermissionColumnNames)})
    `);

    const columnsByTable = new Map<string, string[]>();

    for (const column of columns) {
      if (
        !legacyPermissionTableNames.includes(column.tableName) ||
        !legacyPermissionColumnNames.includes(column.columnName)
      ) {
        continue;
      }

      const tableColumns = columnsByTable.get(column.tableName) ?? [];
      tableColumns.push(column.columnName);
      columnsByTable.set(column.tableName, tableColumns);
    }

    for (const [tableName, tableColumns] of columnsByTable.entries()) {
      if (tableColumns.length === 0) {
        continue;
      }

      const conditions = tableColumns.map((columnName) => Prisma.sql`
        ${Prisma.raw(this.quotePgIdentifier(columnName))} IN (${Prisma.join(
          targetIds,
        )})
      `);

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM ${Prisma.raw(this.quotePgIdentifier(tableName))}
        WHERE ${Prisma.join(conditions, ' OR ')}
      `);
    }
  }

  private quotePgIdentifier(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private async reconcileOperationalTeamAdmins(scope: TeamMemberScope) {
    const teamAdmins = await this.prisma.user.findMany({
      where: {
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        role: UserRole.TEAM_ADMIN,
      },
      include: teamMemberInclude,
      orderBy: [{ createdAt: 'asc' }],
    });

    for (const teamAdmin of teamAdmins) {
      await this.ensureOperationalSponsorProfile(teamAdmin, {
        provisionWallet: true,
      });
    }
  }

  private async ensureOperationalTeamAdminSponsor(
    scope: TeamMemberScope,
    memberId: string,
  ) {
    const member = await this.prisma.user.findFirst({
      where: {
        id: memberId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        role: UserRole.TEAM_ADMIN,
      },
      include: teamMemberInclude,
    });

    if (!member) {
      return;
    }

    await this.ensureOperationalSponsorProfile(member, {
      provisionWallet: true,
    });
  }

  private async ensureOperationalSponsorProfile(
    member: TeamMemberUserRecord,
    options?: {
      provisionWallet?: boolean;
    },
  ) {
    if (
      member.role !== UserRole.TEAM_ADMIN ||
      !member.workspaceId ||
      !member.teamId
    ) {
      return member;
    }

    let normalizedMember = member;

    if (!normalizedMember.sponsor) {
      normalizedMember = await this.prisma.$transaction(async (tx) => {
        const sponsor = await tx.sponsor.create({
          data: {
            workspaceId: normalizedMember.workspaceId!,
            teamId: normalizedMember.teamId!,
            displayName: normalizedMember.fullName,
            publicSlug: await this.generateAvailablePublicSlug(
              tx,
              normalizedMember.fullName,
            ),
            status: 'active',
            isActive: normalizedMember.status === UserStatus.active,
            email: normalizedMember.email,
            phone: null,
            availabilityStatus: 'available',
            routingWeight: 1,
            memberPortalEnabled: true,
          },
        });

        return tx.user.update({
          where: {
            id: normalizedMember.id,
          },
          data: {
            sponsorId: sponsor.id,
          },
          include: teamMemberInclude,
        });
      });
    } else {
      const sponsorUpdates: Prisma.SponsorUpdateInput = {};

      if (!normalizedMember.sponsor.memberPortalEnabled) {
        sponsorUpdates.memberPortalEnabled = true;
      }

      if (!normalizedMember.sponsor.publicSlug) {
        sponsorUpdates.publicSlug = await this.generateAvailablePublicSlug(
          this.prisma,
          normalizedMember.sponsor.displayName || normalizedMember.fullName,
        );
      }

      if (!normalizedMember.sponsor.email) {
        sponsorUpdates.email = normalizedMember.email;
      }

      if (Object.keys(sponsorUpdates).length > 0) {
        normalizedMember = await this.prisma.user.update({
          where: {
            id: normalizedMember.id,
          },
          data: {
            sponsor: {
              update: sponsorUpdates,
            },
          },
          include: teamMemberInclude,
        });
      }
    }

    if (options?.provisionWallet && normalizedMember.sponsorId) {
      try {
        await this.walletEngineService.upsertSponsorAccount(
          normalizedMember.sponsorId,
        );
      } catch (error) {
        this.logger.error(
          `Sponsor ${normalizedMember.sponsorId} wallet normalization failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    return normalizedMember;
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

  private async dispatchAdvisorWelcomeEmail(
    input: {
      email: string;
      temporaryPassword: string;
      teamName: string;
    },
  ) {
    try {
      await this.mailerService.sendAdvisorWelcomeEmail({
        email: input.email,
        tempPassword: input.temporaryPassword,
        teamName: input.teamName,
      });
    } catch (error) {
      this.logger.error(
        `Advisor welcome email failed for ${input.email}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async dispatchAdvisorActivationEmail(input: {
    email: string;
    teamName: string;
    publicSlug: string | null;
  }) {
    try {
      await this.mailerService.sendAdvisorActivationEmail({
        email: input.email,
        teamName: input.teamName,
        publicSlug: input.publicSlug,
      });
    } catch (error) {
      this.logger.error(
        `Advisor activation email failed for ${input.email}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async generateAvailablePublicSlug(
    tx:
      | Prisma.TransactionClient
      | Pick<PrismaService, 'sponsor'>,
    fullName: string,
  ) {
    const baseSlug = slugify(fullName) || 'asesor';

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const existing = await tx.sponsor.findFirst({
        where: {
          publicSlug: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${baseSlug}-${randomBytes(4).toString('hex')}`;
  }
}
