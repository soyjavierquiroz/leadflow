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

const toIso = (value: Date | null) => (value ? value.toISOString() : null);

const teamMemberInclude = {
  sponsor: true,
} satisfies Prisma.UserInclude;

type TeamMemberUserRecord = Prisma.UserGetPayload<{
  include: typeof teamMemberInclude;
}>;

@Injectable()
export class TeamMembersService {
  private readonly logger = new Logger(TeamMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletEngineService: WalletEngineService,
    private readonly mailerService: MailerService,
  ) {}

  async list(scope: TeamMemberScope): Promise<TeamMembersSnapshot> {
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

    const mutation = await this.prisma.$transaction(async (tx) => {
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

      const activeSeats = await this.countActiveSeats(scope, tx);

      return {
        team: this.buildSeatSummary(team, activeSeats),
        member: this.mapTeamMember({
          ...member,
          sponsor,
        }),
        activationEmail:
          shouldActivate && member.email
            ? {
                email: member.email,
                teamName: team.name,
              }
            : null,
      };
    });

    if (mutation.activationEmail) {
      await this.dispatchAdvisorActivationEmail(
        mutation.activationEmail.email,
        mutation.activationEmail.teamName,
      );
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
          status: UserStatus.active,
        },
        include: teamMemberInclude,
      });

      const sponsor = await tx.sponsor.create({
        data: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          displayName: fullName,
          status: 'active',
          isActive: false,
          email,
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
        },
      };
    });

    if (invitation.member.sponsorId) {
      void this.provisionSponsorWelcomeKredits(invitation.member.sponsorId);
    }

    await this.dispatchAdvisorWelcomeEmail(
      invitation.welcomeEmail.email,
      invitation.temporaryPassword,
    );

    return {
      team: invitation.team,
      member: invitation.member,
      temporaryPassword: invitation.temporaryPassword,
    };
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
  ) {
    return tx.sponsor.count({
      where: {
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        isActive: true,
      },
    });
  }

  private async assertSeatAvailability(
    scope: TeamMemberScope,
    maxSeats: number,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
    excludedSponsorId?: string,
  ) {
    const activeSeats = await tx.sponsor.count({
      where: {
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        isActive: true,
        ...(excludedSponsorId
          ? {
              id: {
                not: excludedSponsorId,
              },
            }
          : {}),
      },
    });

    if (activeSeats >= maxSeats) {
      throw new BadRequestException({
        code: 'TEAM_SEAT_LIMIT_REACHED',
        message: `Has alcanzado el limite de ${maxSeats} licencias activas. Desactiva un usuario primero.`,
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
    email: string,
    temporaryPassword: string,
  ) {
    try {
      await this.mailerService.sendAdvisorWelcomeEmail(
        email,
        temporaryPassword,
      );
    } catch (error) {
      this.logger.error(
        `Advisor welcome email failed for ${email}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async dispatchAdvisorActivationEmail(email: string, teamName: string) {
    try {
      await this.mailerService.sendAdvisorActivationEmail(email, teamName);
    } catch (error) {
      this.logger.error(
        `Advisor activation email failed for ${email}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
