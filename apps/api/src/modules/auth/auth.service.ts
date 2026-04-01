import { createHash, randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus, type Prisma } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { getApiRuntimeConfig } from '../../config/runtime';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyPassword } from './password-hash.util';
import type { AuthRequest, AuthenticatedUser } from './auth.types';

const authUserInclude = {
  workspace: true,
  team: true,
  sponsor: true,
} satisfies Prisma.UserInclude;

type AuthUserRecord = Prisma.UserGetPayload<{
  include: typeof authUserInclude;
}>;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(input: {
    email: string;
    password: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: input.email.trim().toLowerCase(),
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
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
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
}
