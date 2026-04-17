import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole, UserStatus, type Prisma } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { getApiRuntimeConfig } from '../../config/runtime';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password-hash.util';
import type { AuthRequest, AuthenticatedUser } from './auth.types';

const authUserInclude = {
  workspace: true,
  team: true,
  sponsor: true,
} satisfies Prisma.UserInclude;

type AuthUserRecord = Prisma.UserGetPayload<{
  include: typeof authUserInclude;
}>;

export type MyProfileSnapshot = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  phone: string | null;
  sponsorDisplayName: string | null;
  avatarUrl: string | null;
  updatedAt: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async authenticate(input: {
    email: string;
    password: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }) {
    const normalizedEmail = input.email.trim().toLowerCase();

    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
        include: authUserInclude,
      });

      if (
        !user ||
        user.status !== UserStatus.active ||
        !verifyPassword(input.password, user.passwordHash)
      ) {
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is invalid.',
        });
      }

      return this.createSessionForUser(user, {
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const stack =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      const isPrismaRuntimeError =
        error instanceof Error &&
        [
          'PrismaClientInitializationError',
          'PrismaClientKnownRequestError',
          'PrismaClientRustPanicError',
          'PrismaClientUnknownRequestError',
          'PrismaClientValidationError',
        ].includes(error.name);

      this.logger.error('🔥 CRITICAL LOGIN API ERROR:', stack);
      this.logger.error(
        `Critical login failure for ${normalizedEmail} (ip=${input.ipAddress ?? 'unknown'}, userAgent=${input.userAgent ?? 'unknown'})`,
      );

      if (isPrismaRuntimeError) {
        throw new ServiceUnavailableException({
          code: 'AUTH_STORAGE_UNAVAILABLE',
          message:
            'Authentication is temporarily unavailable while the data store recovers.',
        });
      }

      throw new ServiceUnavailableException({
        code: 'AUTH_LOGIN_UNAVAILABLE',
        message:
          'Authentication is temporarily unavailable. Please try again shortly.',
      });
    }
  }

  async impersonate(input: {
    targetUserId: string;
    impersonator: AuthenticatedUser;
    userAgent?: string | null;
    ipAddress?: string | null;
  }) {
    const targetUserId = input.targetUserId.trim();

    if (!targetUserId) {
      throw new BadRequestException({
        code: 'TARGET_USER_REQUIRED',
        message: 'A target user id is required to impersonate a session.',
      });
    }

    const targetUser = await this.prisma.user.findUnique({
      where: {
        id: targetUserId,
      },
      include: authUserInclude,
    });

    if (!targetUser || targetUser.status !== UserStatus.active) {
      throw new NotFoundException({
        code: 'TARGET_USER_NOT_FOUND',
        message: 'The requested target user was not found or is inactive.',
      });
    }

    if (targetUser.role === UserRole.SUPER_ADMIN || !targetUser.teamId) {
      throw new BadRequestException({
        code: 'TARGET_USER_NOT_IMPERSONABLE',
        message:
          'Only active tenant users with a team scope can be impersonated.',
      });
    }

    this.logger.warn(
      `Super admin ${input.impersonator.id} impersonated user ${targetUser.id} (${targetUser.role}) on team ${targetUser.teamId}.`,
    );

    return this.createSessionForUser(targetUser, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  async resolveAuthenticatedUser(sessionToken: string) {
    const sessionTokenHash = this.hashSessionToken(sessionToken);
    const session = await this.prisma.authSession.findUnique({
      where: {
        sessionTokenHash,
      },
      include: {
        user: {
          include: authUserInclude,
        },
      },
    });

    if (
      !session ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.status !== UserStatus.active
    ) {
      if (session) {
        await this.prisma.authSession.delete({
          where: { id: session.id },
        });
      }

      return null;
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date(),
      },
    });

    return this.toAuthenticatedUser(session.user);
  }

  async invalidateSession(sessionToken: string | null | undefined) {
    if (!sessionToken) {
      return;
    }

    await this.prisma.authSession.deleteMany({
      where: {
        sessionTokenHash: this.hashSessionToken(sessionToken),
      },
    });
  }

  async getMyProfile(userId: string): Promise<MyProfileSnapshot> {
    const user = await this.requireUserProfileRecord(userId);
    return this.toMyProfileSnapshot(user);
  }

  async updateMyProfile(
    userId: string,
    input: {
      fullName?: string;
      phone?: string | null;
    },
  ): Promise<MyProfileSnapshot> {
    if (input.fullName === undefined && input.phone === undefined) {
      throw new BadRequestException({
        code: 'MY_PROFILE_UPDATE_EMPTY',
        message: 'At least one profile field is required.',
      });
    }

    const existing = await this.requireUserProfileRecord(userId);
    const fullName =
      input.fullName === undefined
        ? existing.fullName
        : this.normalizeRequiredName(input.fullName);
    const phone =
      input.phone === undefined
        ? existing.sponsor?.phone ?? null
        : this.normalizeOptionalText(input.phone);

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          fullName,
        },
        include: authUserInclude,
      });

      if (existing.sponsorId) {
        const sponsor = await tx.sponsor.update({
          where: {
            id: existing.sponsorId,
          },
          data: {
            displayName: fullName,
            phone,
          },
        });

        user.sponsor = sponsor;
      }

      return user;
    });

    return this.toMyProfileSnapshot(updated);
  }

  async changeMyPassword(
    userId: string,
    input: {
      currentPassword?: string;
      newPassword?: string;
    },
  ) {
    const currentPassword = input.currentPassword ?? '';
    const newPassword = input.newPassword ?? '';

    if (!currentPassword || !newPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_FIELDS_REQUIRED',
        message: 'Current password and new password are required.',
      });
    }

    if (newPassword.length < 8) {
      throw new BadRequestException({
        code: 'PASSWORD_TOO_SHORT',
        message: 'The new password must have at least 8 characters.',
      });
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_UNCHANGED',
        message: 'The new password must be different from the current one.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'The authenticated user could not be found.',
      });
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException({
        code: 'CURRENT_PASSWORD_INVALID',
        message: 'The current password is incorrect.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(newPassword),
      },
    });

    return {
      success: true as const,
    };
  }

  readSessionTokenFromRequest(request: AuthRequest) {
    const runtimeConfig = getApiRuntimeConfig();
    return request.cookies?.[runtimeConfig.authCookieName] ?? null;
  }

  setSessionCookie(reply: FastifyReply, sessionToken: string) {
    const runtimeConfig = getApiRuntimeConfig();
    const maxAge = runtimeConfig.authSessionTtlDays * 24 * 60 * 60;

    reply.setCookie(runtimeConfig.authCookieName, sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: runtimeConfig.authCookieSecure,
      domain: runtimeConfig.authCookieDomain,
      maxAge,
    });
  }

  clearSessionCookie(reply: FastifyReply) {
    const runtimeConfig = getApiRuntimeConfig();

    reply.clearCookie(runtimeConfig.authCookieName, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: runtimeConfig.authCookieSecure,
      domain: runtimeConfig.authCookieDomain,
    });
  }

  private generateSessionToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashSessionToken(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async createSessionForUser(
    user: AuthUserRecord,
    input?: {
      userAgent?: string | null;
      ipAddress?: string | null;
    },
  ) {
    const sessionToken = this.generateSessionToken();
    const sessionTokenHash = this.hashSessionToken(sessionToken);
    const runtimeConfig = getApiRuntimeConfig();
    const expiresAt = new Date(
      Date.now() + runtimeConfig.authSessionTtlDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        sessionTokenHash,
        expiresAt,
        lastSeenAt: new Date(),
        userAgent: input?.userAgent ?? null,
        ipAddress: input?.ipAddress ?? null,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return {
      sessionToken,
      user: this.toAuthenticatedUser(user),
    };
  }

  private toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      workspaceId: user.workspaceId,
      teamId: user.teamId,
      sponsorId: user.sponsorId,
      homePath:
        user.role === 'SUPER_ADMIN'
          ? '/admin'
          : user.role === 'TEAM_ADMIN'
            ? '/team'
            : '/member',
      workspace: user.workspace
        ? {
            id: user.workspace.id,
            name: user.workspace.name,
            slug: user.workspace.slug,
            primaryDomain: user.workspace.primaryDomain,
          }
        : null,
      team: user.team
        ? {
            id: user.team.id,
            name: user.team.name,
            code: user.team.code,
          }
        : null,
      sponsor: user.sponsor
        ? {
            id: user.sponsor.id,
            displayName: user.sponsor.displayName,
            email: user.sponsor.email,
            isActive: user.sponsor.isActive,
            availabilityStatus: user.sponsor.availabilityStatus,
          }
        : null,
    };
  }

  private async requireUserProfileRecord(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: authUserInclude,
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'The authenticated user could not be found.',
      });
    }

    return user;
  }

  private normalizeRequiredName(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException({
        code: 'FULL_NAME_REQUIRED',
        message: 'fullName is required.',
      });
    }

    return trimmed;
  }

  private normalizeOptionalText(value: string | null | undefined) {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private toMyProfileSnapshot(user: AuthUserRecord): MyProfileSnapshot {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phone: user.sponsor?.phone ?? null,
      sponsorDisplayName: user.sponsor?.displayName ?? null,
      avatarUrl: user.sponsor?.avatarUrl ?? null,
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
