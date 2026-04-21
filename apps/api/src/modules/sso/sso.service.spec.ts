import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SsoService } from './sso.service';

describe('SsoService', () => {
  const buildUser = (
    overrides: Partial<AuthenticatedUser> = {},
  ): AuthenticatedUser => ({
    id: 'member-1',
    fullName: 'Advisor Uno',
    email: 'advisor@example.com',
    role: UserRole.MEMBER,
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    sponsorId: null,
    homePath: '/member',
    workspace: {
      id: 'workspace-1',
      name: 'Workspace Uno',
      slug: 'workspace-uno',
      primaryDomain: 'workspace-uno.example.com',
    },
    team: {
      id: 'team-1',
      name: 'Team Uno',
      code: 'TEAM-UNO',
    },
    sponsor: null,
    ...overrides,
  });

  const buildService = ({
    blacklistSecret = 'secret-123',
    adminToken = 'kurukin-static-admin-key',
  }: {
    blacklistSecret?: string;
    adminToken?: string;
  } = {}) => {
    const prisma = {
      user: {
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'SSO_BLACKLIST_SECRET') {
          return blacklistSecret;
        }

        if (key === 'KURUKIN_BLACKLIST_API_TOKEN') {
          return adminToken;
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    return {
      prisma,
      configService,
      service: new SsoService(prisma, configService),
    };
  };

  it('loads the advisor phone from prisma before signing the token', async () => {
    const { prisma, service } = buildService();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    prisma.user.findFirst = jest.fn().mockResolvedValue({
      sponsorId: 'sponsor-1',
      sponsor: {
        phone: '59179790873',
      },
    });

    const result = await service.buildBlacklistUrl(buildUser());

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'member-1',
        role: UserRole.MEMBER,
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
      select: {
        sponsorId: true,
        sponsor: {
          select: {
            phone: true,
          },
        },
      },
    });
    expect(result.url).toMatch(
      /^https:\/\/blacklist\.kuruk\.in\/dashboard\/importaciones\?token=/,
    );
    expect(logSpy).toHaveBeenCalledWith('SSO_FLOW_DIAGNOSTIC:', {
      hasSecret: true,
      phoneFound: '59179790873',
    });

    logSpy.mockRestore();
  });

  it('fails when the advisor phone is still missing in the database', async () => {
    const { prisma, service } = buildService();

    prisma.user.findFirst = jest.fn().mockResolvedValue({
      sponsorId: 'sponsor-1',
      sponsor: {
        phone: null,
      },
    });

    await expect(service.buildBlacklistUrl(buildUser())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('builds a God Mode url for SUPER_ADMIN access', () => {
    const adminToken = 'admin-master-key';
    const { service } = buildService({ adminToken });
    const result = service.buildAdminBlacklistUrl();
    const url = new URL(result.url);
    const adminKey = url.searchParams.get('admin_key');

    expect(url.origin + url.pathname).toBe(
      'https://blacklist.kuruk.in/dashboard/reportes',
    );
    expect(adminKey).toBe(adminToken);
  });
});
