import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  AccountType,
  Prisma,
  TeamType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { hashPassword } from '../auth/password-hash.util';
import { MailService } from '../mail/mail.service';
import type { CreateSystemIndividualAccountDto } from './dto/create-system-individual-account.dto';
import type { ProvisionIndividualAccountDto } from './dto/provision-individual-account.dto';

const defaultRotationPoolName = 'Rotación Orgánica Principal';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export type ProvisionIndividualAccountResult = {
  workspaceId: string;
  teamId: string;
  sponsorId: string;
  userId: string;
  accountType: 'individual';
  teamType: 'personal';
};

export type CreateSystemIndividualAccountResult =
  ProvisionIndividualAccountResult & {
    email: string;
    temporaryPassword: string;
    loginUrl: '/login';
    recommendedRedirect: '/member/crm';
  };

type ProvisioningUserRecord = Prisma.UserGetPayload<{
  include: {
    workspace: true;
    team: true;
    sponsor: true;
  };
}>;

type ProvisioningTransaction = Prisma.TransactionClient;

@Injectable()
export class AccountProvisioningService {
  private readonly logger = new Logger(AccountProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async provisionIndividualAccount(
    user: Pick<AuthenticatedUser, 'id'>,
    payload: ProvisionIndividualAccountDto,
  ): Promise<ProvisionIndividualAccountResult> {
    return this.prisma.$transaction(async (tx) => {
      return this.provisionIndividualAccountForUser(tx, user.id, payload);
    });
  }

  async createSystemIndividualAccount(
    payload: CreateSystemIndividualAccountDto,
  ): Promise<CreateSystemIndividualAccountResult> {
    const name = sanitizeRequiredText(payload.name, 'name');
    const email = this.normalizeEmail(payload.email, 'email');
    const businessName = sanitizeRequiredText(
      payload.businessName,
      'businessName',
    );
    const temporaryPassword =
      sanitizeOptionalText(payload.temporaryPassword) ??
      this.generateTemporaryPassword();

    let context: ProvisionIndividualAccountResult;

    try {
      context = await this.prisma.$transaction(async (tx) => {
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
            code: 'INDIVIDUAL_ACCOUNT_EMAIL_EXISTS',
            message: 'A user with this email already exists.',
          });
        }

        const user = await tx.user.create({
          data: {
            fullName: name,
            email,
            passwordHash: hashPassword(temporaryPassword),
            role: UserRole.TEAM_ADMIN,
            status: UserStatus.active,
          },
          select: {
            id: true,
          },
        });

        return this.provisionIndividualAccountForUser(tx, user.id, {
          businessName,
          niche: payload.niche,
          country: payload.country,
          phone: payload.phone,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'INDIVIDUAL_ACCOUNT_EMAIL_EXISTS',
          message: 'A user with this email already exists.',
        });
      }

      throw error;
    }

    if (payload.sendInviteEmail === true) {
      try {
        await this.mailService.sendWelcomeEmail(
          email,
          temporaryPassword,
          businessName,
        );
      } catch (error) {
        this.logger.error(
          `Individual account welcome email failed for ${email}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    return {
      ...context,
      email,
      temporaryPassword,
      loginUrl: '/login',
      recommendedRedirect: '/member/crm',
    };
  }

  private async provisionIndividualAccountForUser(
    tx: ProvisioningTransaction,
    userId: string,
    payload: ProvisionIndividualAccountDto,
  ): Promise<ProvisionIndividualAccountResult> {
    const businessName = sanitizeRequiredText(
      payload.businessName,
      'businessName',
    );
    const phone = sanitizeOptionalText(payload.phone);

    const existingUser = await tx.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        workspace: true,
        team: true,
        sponsor: true,
      },
    });

    if (!existingUser) {
      throw new BadRequestException({
        code: 'USER_NOT_FOUND',
        message: 'The authenticated user was not found.',
      });
    }

    this.assertCanProvisionIndividualAccount(existingUser);

    const workspace =
      existingUser.workspace?.accountType === AccountType.individual
        ? existingUser.workspace
        : await this.createIndividualWorkspace(tx, businessName, userId);

    const team =
      existingUser.team?.teamType === TeamType.personal
        ? existingUser.team
        : await this.createPersonalTeam(tx, {
            workspaceId: workspace.id,
            businessName,
            userId,
          });

    const sponsor =
      existingUser.sponsor?.teamId === team.id
        ? await this.normalizeExistingSponsor(tx, {
            sponsorId: existingUser.sponsor.id,
            userEmail: existingUser.email,
            phone,
          })
        : await this.findOrCreateOwnerSponsor(tx, {
            workspaceId: workspace.id,
            teamId: team.id,
            userId: existingUser.id,
            fullName: existingUser.fullName,
            email: existingUser.email,
            businessName,
            phone,
          });

    const nextRole =
      existingUser.role === UserRole.SUPER_ADMIN
        ? UserRole.SUPER_ADMIN
        : UserRole.TEAM_ADMIN;

    const shouldUpdateUser =
      existingUser.workspaceId !== workspace.id ||
      existingUser.teamId !== team.id ||
      existingUser.sponsorId !== sponsor.id ||
      existingUser.role !== nextRole;

    if (shouldUpdateUser) {
      await tx.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          workspaceId: workspace.id,
          teamId: team.id,
          sponsorId: sponsor.id,
          role: nextRole,
        },
      });
    }

    if (team.managerUserId !== existingUser.id) {
      await tx.team.update({
        where: {
          id: team.id,
        },
        data: {
          managerUserId: existingUser.id,
        },
      });
    }

    await this.ensureDefaultRotationPool(tx, {
      workspaceId: workspace.id,
      teamId: team.id,
      sponsorId: sponsor.id,
    });

    return {
      workspaceId: workspace.id,
      teamId: team.id,
      sponsorId: sponsor.id,
      userId: existingUser.id,
      accountType: 'individual',
      teamType: 'personal',
    };
  }

  private assertCanProvisionIndividualAccount(user: ProvisioningUserRecord) {
    const hasExistingTenantScope = Boolean(user.workspaceId || user.teamId);

    if (!hasExistingTenantScope) {
      return;
    }

    if (
      user.workspaceId &&
      user.workspace?.accountType !== AccountType.individual
    ) {
      throw new ConflictException({
        code: 'USER_ALREADY_HAS_TEAM_TENANT',
        message:
          'This user already belongs to a tenant that is not an individual personal team.',
      });
    }

    if (user.teamId && user.team?.teamType !== TeamType.personal) {
      throw new ConflictException({
        code: 'USER_ALREADY_HAS_TEAM_TENANT',
        message:
          'This user already belongs to a tenant that is not an individual personal team.',
      });
    }

    if (user.teamId && !user.workspaceId) {
      throw new ConflictException({
        code: 'USER_ALREADY_HAS_TEAM_TENANT',
        message:
          'This user already belongs to a tenant that is not an individual personal team.',
      });
    }

    if (user.workspaceId && user.workspace === null) {
      throw new ConflictException({
        code: 'USER_ALREADY_HAS_TEAM_TENANT',
        message:
          'This user already belongs to a tenant that is not an individual personal team.',
      });
    }

    if (user.teamId && user.team === null) {
      throw new ConflictException({
        code: 'USER_ALREADY_HAS_TEAM_TENANT',
        message:
          'This user already belongs to a tenant that is not an individual personal team.',
      });
    }

    if (
      user.workspace?.accountType === AccountType.individual &&
      (!user.teamId || user.team?.teamType === TeamType.personal)
    ) {
      return;
    }

    throw new ConflictException({
      code: 'USER_ALREADY_HAS_TEAM_TENANT',
      message:
        'This user already belongs to a tenant that is not an individual personal team.',
    });
  }

  private async createIndividualWorkspace(
    tx: ProvisioningTransaction,
    businessName: string,
    userId: string,
  ) {
    const slug = await this.resolveAvailableWorkspaceSlug(
      tx,
      businessName,
      userId,
    );

    return tx.workspace.create({
      data: {
        name: businessName,
        slug,
        status: 'active',
        accountType: AccountType.individual,
        timezone: 'UTC',
        defaultCurrency: 'USD',
        primaryLocale: 'es',
        primaryDomain: null,
      },
    });
  }

  private async createPersonalTeam(
    tx: ProvisioningTransaction,
    input: {
      workspaceId: string;
      businessName: string;
      userId: string;
    },
  ) {
    const code = await this.resolveAvailableTeamCode(tx, input);

    return tx.team.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.businessName,
        code,
        status: 'active',
        teamType: TeamType.personal,
        isActive: true,
        subscriptionExpiresAt: null,
        description: null,
        maxSeats: 1,
      },
    });
  }

  private async normalizeExistingSponsor(
    tx: ProvisioningTransaction,
    input: {
      sponsorId: string;
      userEmail: string;
      phone: string | null;
    },
  ) {
    const sponsor = await tx.sponsor.findUniqueOrThrow({
      where: {
        id: input.sponsorId,
      },
    });
    const updateData: Prisma.SponsorUpdateInput = {};

    if (sponsor.status !== 'active') {
      updateData.status = 'active';
    }

    if (!sponsor.isActive) {
      updateData.isActive = true;
    }

    if (sponsor.availabilityStatus !== 'available') {
      updateData.availabilityStatus = 'available';
    }

    if (!sponsor.memberPortalEnabled) {
      updateData.memberPortalEnabled = true;
    }

    if (!sponsor.email) {
      updateData.email = input.userEmail;
    }

    if (!sponsor.phone && input.phone) {
      updateData.phone = input.phone;
    }

    if (Object.keys(updateData).length === 0) {
      return sponsor;
    }

    return tx.sponsor.update({
      where: {
        id: sponsor.id,
      },
      data: updateData,
    });
  }

  private async findOrCreateOwnerSponsor(
    tx: ProvisioningTransaction,
    input: {
      workspaceId: string;
      teamId: string;
      userId: string;
      fullName: string;
      email: string;
      businessName: string;
      phone: string | null;
    },
  ) {
    const existingOwnerUser = await tx.user.findFirst({
      where: {
        id: input.userId,
        sponsor: {
          teamId: input.teamId,
        },
      },
      select: {
        sponsor: true,
      },
    });

    if (existingOwnerUser?.sponsor) {
      return existingOwnerUser.sponsor;
    }

    const existingSponsor = await tx.sponsor.findFirst({
      where: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        email: input.email,
      },
    });

    if (existingSponsor) {
      return existingSponsor;
    }

    return tx.sponsor.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        displayName: input.fullName || input.businessName,
        publicSlug: await this.resolveAvailablePublicSlug(tx, input.fullName),
        status: 'active',
        isActive: true,
        email: input.email,
        phone: input.phone,
        availabilityStatus: 'available',
        routingWeight: 1,
        memberPortalEnabled: true,
      },
    });
  }

  private async ensureDefaultRotationPool(
    tx: ProvisioningTransaction,
    input: {
      workspaceId: string;
      teamId: string;
      sponsorId: string;
    },
  ) {
    const existingPool = await tx.rotationPool.findFirst({
      where: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        isFallbackPool: true,
        status: 'active',
      },
      include: {
        members: true,
      },
    });

    if (existingPool) {
      const hasOwnerMember = existingPool.members.some(
        (member) => member.sponsorId === input.sponsorId,
      );

      if (!hasOwnerMember) {
        await tx.rotationMember.create({
          data: {
            rotationPoolId: existingPool.id,
            sponsorId: input.sponsorId,
            position: existingPool.members.length + 1,
            weight: 1,
            isActive: true,
          },
        });
      }

      return existingPool;
    }

    const name = await this.resolveAvailableRotationPoolName(
      tx,
      input.workspaceId,
    );

    return tx.rotationPool.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        name,
        status: 'active',
        strategy: 'round_robin',
        isFallbackPool: true,
        members: {
          create: [
            {
              sponsorId: input.sponsorId,
              position: 1,
              weight: 1,
              isActive: true,
            },
          ],
        },
      },
    });
  }

  private async resolveAvailableWorkspaceSlug(
    tx: ProvisioningTransaction,
    businessName: string,
    userId: string,
  ) {
    const baseSlug = slugify(businessName) || 'individual';
    const userSuffix = slugify(userId).slice(0, 8) || 'user';
    const candidates = [`${baseSlug}-${userSuffix}`, baseSlug];

    for (const candidate of candidates) {
      const existing = await tx.workspace.findUnique({
        where: {
          slug: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${baseSlug}-${userSuffix}-${Date.now().toString(36)}`;
  }

  private async resolveAvailableTeamCode(
    tx: ProvisioningTransaction,
    input: {
      workspaceId: string;
      businessName: string;
      userId: string;
    },
  ) {
    const baseCode = slugify(input.businessName) || 'individual';
    const userSuffix = slugify(input.userId).slice(0, 8) || 'user';
    const candidates = [`${baseCode}-${userSuffix}`, baseCode];

    for (const candidate of candidates) {
      const existing = await tx.team.findFirst({
        where: {
          workspaceId: input.workspaceId,
          code: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${baseCode}-${userSuffix}-${Date.now().toString(36)}`;
  }

  private async resolveAvailablePublicSlug(
    tx: ProvisioningTransaction,
    value: string,
  ) {
    const baseSlug = slugify(value) || 'sponsor';

    for (let index = 0; index < 5; index += 1) {
      const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
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

    return `${baseSlug}-${Date.now().toString(36)}`;
  }

  private async resolveAvailableRotationPoolName(
    tx: ProvisioningTransaction,
    workspaceId: string,
  ) {
    const candidates = [
      defaultRotationPoolName,
      `${defaultRotationPoolName} - Personal`,
    ];

    for (const candidate of candidates) {
      const existing = await tx.rotationPool.findFirst({
        where: {
          workspaceId,
          name: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${defaultRotationPoolName} - Personal ${Date.now().toString(36)}`;
  }

  private normalizeEmail(value: string | null | undefined, field: string) {
    const email = sanitizeRequiredText(value, field).toLowerCase();

    if (!emailPattern.test(email)) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL',
        message: `${field} must be a valid email address.`,
        field,
      });
    }

    return email;
  }

  private generateTemporaryPassword() {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

    return Array.from(
      randomBytes(14),
      (byte) => alphabet[byte % alphabet.length],
    )
      .join('')
      .slice(0, 14);
  }
}
