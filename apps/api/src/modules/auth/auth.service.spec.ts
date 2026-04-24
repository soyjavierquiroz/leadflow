import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { WalletEngineService } from '../finance/wallet-engine.service';
import { hashPassword } from './password-hash.util';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const buildService = () => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      authSession: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const walletEngineService = {
      upsertSponsorAccount: jest.fn().mockResolvedValue({
        accountId: 'account-kredit-1',
      }),
      creditInitialKredits: jest.fn(),
    } as unknown as WalletEngineService;

    return {
      prisma,
      walletEngineService,
      service: new AuthService(prisma, walletEngineService),
    };
  };

  const activeTeamAdminUser = {
    id: 'user-team-admin-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    sponsorId: 'sponsor-1',
    fullName: 'Tenant Admin',
    email: 'tenant-admin@example.com',
    passwordHash: hashPassword('Tenant123!'),
    role: UserRole.TEAM_ADMIN,
    status: UserStatus.active,
    lastLoginAt: null,
    workspace: {
      id: 'workspace-1',
      name: 'Workspace Uno',
      slug: 'workspace-uno',
      primaryDomain: 'workspace-uno.example.com',
    },
    team: {
      id: 'team-1',
      name: 'Team Uno',
      code: 'team-uno',
    },
    sponsor: {
      id: 'sponsor-1',
      displayName: 'Sponsor Uno',
      email: 'tenant-admin@example.com',
      isActive: true,
      availabilityStatus: 'available',
      memberPortalEnabled: true,
      publicSlug: 'sponsor-uno',
    },
  };

  const activeMemberUser = {
    ...activeTeamAdminUser,
    id: 'user-member-1',
    sponsorId: 'sponsor-2',
    fullName: 'Advisor Uno',
    email: 'advisor@example.com',
    role: UserRole.MEMBER,
    sponsor: {
      id: 'sponsor-2',
      displayName: 'Advisor Uno',
      email: 'advisor@example.com',
      isActive: true,
      availabilityStatus: 'available',
      memberPortalEnabled: true,
      publicSlug: 'advisor-uno',
    },
  };

  it('creates a normal session for valid credentials', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.user.findUnique = jest.fn().mockResolvedValue(activeTeamAdminUser);
    prisma.authSession.create = jest.fn().mockResolvedValue({});
    prisma.user.update = jest.fn().mockResolvedValue({});

    const result = await service.authenticate({
      email: 'tenant-admin@example.com',
      password: 'Tenant123!',
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
    });

    expect(result.user.id).toBe(activeTeamAdminUser.id);
    expect(result.user.homePath).toBe('/team');
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: activeTeamAdminUser.id,
        userAgent: 'jest',
        ipAddress: '127.0.0.1',
      }),
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: activeTeamAdminUser.id },
      data: {
        lastLoginAt: expect.any(Date),
      },
    });
    expect(walletEngineService.upsertSponsorAccount).toHaveBeenCalledWith(
      activeTeamAdminUser.sponsorId,
    );
    expect(walletEngineService.creditInitialKredits).not.toHaveBeenCalled();
  });

  it('creates a tenant session for a super admin impersonation target', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.user.findUnique = jest.fn().mockResolvedValue(activeTeamAdminUser);
    prisma.authSession.create = jest.fn().mockResolvedValue({});
    prisma.user.update = jest.fn().mockResolvedValue({});

    const result = await service.impersonate({
      targetUserId: activeTeamAdminUser.id,
      impersonator: {
        id: 'super-admin-1',
        fullName: 'Root Admin',
        email: 'root@example.com',
        role: UserRole.SUPER_ADMIN,
        workspaceId: null,
        teamId: null,
        sponsorId: null,
        homePath: '/admin',
        workspace: null,
        team: null,
        sponsor: null,
      },
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
    });

    expect(result.user.id).toBe(activeTeamAdminUser.id);
    expect(result.user.role).toBe(UserRole.TEAM_ADMIN);
    expect(result.user.homePath).toBe('/team');
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: activeTeamAdminUser.id,
      }),
    });
    expect(walletEngineService.upsertSponsorAccount).toHaveBeenCalledWith(
      activeTeamAdminUser.sponsorId,
    );
    expect(walletEngineService.creditInitialKredits).not.toHaveBeenCalled();
  });

  it('creates an advisor session for a team admin impersonation target in the same team', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.user.findUnique = jest.fn().mockResolvedValue(activeMemberUser);
    prisma.authSession.create = jest.fn().mockResolvedValue({});
    prisma.user.update = jest.fn().mockResolvedValue({});

    const result = await service.impersonate({
      targetUserId: activeMemberUser.id,
      impersonator: {
        id: activeTeamAdminUser.id,
        fullName: activeTeamAdminUser.fullName,
        email: activeTeamAdminUser.email,
        role: UserRole.TEAM_ADMIN,
        workspaceId: activeTeamAdminUser.workspaceId,
        teamId: activeTeamAdminUser.teamId,
        sponsorId: activeTeamAdminUser.sponsorId,
        homePath: '/team',
        workspace: activeTeamAdminUser.workspace,
        team: activeTeamAdminUser.team,
        sponsor: activeTeamAdminUser.sponsor,
      },
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
      requiredWorkspaceId: activeTeamAdminUser.workspaceId,
      requiredTeamId: activeTeamAdminUser.teamId,
      allowedTargetRoles: [UserRole.MEMBER],
    });

    expect(result.user.id).toBe(activeMemberUser.id);
    expect(result.user.role).toBe(UserRole.MEMBER);
    expect(result.user.homePath).toBe('/member');
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: activeMemberUser.id,
      }),
    });
    expect(walletEngineService.upsertSponsorAccount).not.toHaveBeenCalled();
    expect(walletEngineService.creditInitialKredits).not.toHaveBeenCalled();
  });

  it('creates and links an operational sponsor for team admins missing sponsor data', async () => {
    const { prisma, walletEngineService, service } = buildService();
    const teamAdminWithoutSponsor = {
      ...activeTeamAdminUser,
      sponsorId: null,
      sponsor: null,
    };
    const repairedTeamAdmin = {
      ...activeTeamAdminUser,
      sponsorId: 'sponsor-repaired-1',
      sponsor: {
        ...activeTeamAdminUser.sponsor,
        id: 'sponsor-repaired-1',
      },
    };
    const tx = {
      sponsor: {
        create: jest.fn().mockResolvedValue({
          id: 'sponsor-repaired-1',
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      user: {
        update: jest.fn().mockResolvedValue(repairedTeamAdmin),
      },
    };

    prisma.user.findUnique = jest.fn().mockResolvedValue(teamAdminWithoutSponsor);
    prisma.authSession.create = jest.fn().mockResolvedValue({});
    prisma.user.update = jest.fn().mockResolvedValue({});
    prisma.$transaction = jest
      .fn()
      .mockImplementation((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      );

    const result = await service.authenticate({
      email: teamAdminWithoutSponsor.email,
      password: 'Tenant123!',
    });

    expect(result.user.sponsorId).toBe('sponsor-repaired-1');
    expect(walletEngineService.upsertSponsorAccount).toHaveBeenCalledWith(
      'sponsor-repaired-1',
    );
    expect(walletEngineService.creditInitialKredits).toHaveBeenCalledWith(
      'account-kredit-1',
      'sponsor-repaired-1',
    );
  });

  it('rejects targets that are not active tenant users', async () => {
    const { prisma, service } = buildService();

    prisma.user.findUnique = jest.fn().mockResolvedValue({
      ...activeTeamAdminUser,
      role: UserRole.SUPER_ADMIN,
      teamId: null,
    });

    await expect(
      service.impersonate({
        targetUserId: 'super-admin-2',
        impersonator: {
          id: 'super-admin-1',
          fullName: 'Root Admin',
          email: 'root@example.com',
          role: UserRole.SUPER_ADMIN,
          workspaceId: null,
          teamId: null,
          sponsorId: null,
          homePath: '/admin',
          workspace: null,
          team: null,
          sponsor: null,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects team admin impersonation targets outside the admin team scope', async () => {
    const { prisma, service } = buildService();

    prisma.user.findUnique = jest.fn().mockResolvedValue({
      ...activeMemberUser,
      workspaceId: 'workspace-2',
      teamId: 'team-2',
      workspace: {
        ...activeMemberUser.workspace,
        id: 'workspace-2',
        slug: 'workspace-dos',
      },
      team: {
        ...activeMemberUser.team,
        id: 'team-2',
        code: 'team-dos',
      },
    });

    await expect(
      service.impersonate({
        targetUserId: activeMemberUser.id,
        impersonator: {
          id: activeTeamAdminUser.id,
          fullName: activeTeamAdminUser.fullName,
          email: activeTeamAdminUser.email,
          role: UserRole.TEAM_ADMIN,
          workspaceId: activeTeamAdminUser.workspaceId,
          teamId: activeTeamAdminUser.teamId,
          sponsorId: activeTeamAdminUser.sponsorId,
          homePath: '/team',
          workspace: activeTeamAdminUser.workspace,
          team: activeTeamAdminUser.team,
          sponsor: activeTeamAdminUser.sponsor,
        },
        requiredWorkspaceId: activeTeamAdminUser.workspaceId,
        requiredTeamId: activeTeamAdminUser.teamId,
        allowedTargetRoles: [UserRole.MEMBER],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails when the impersonation target is missing', async () => {
    const { prisma, service } = buildService();

    prisma.user.findUnique = jest.fn().mockResolvedValue(null);

    await expect(
      service.impersonate({
        targetUserId: 'missing-user',
        impersonator: {
          id: 'super-admin-1',
          fullName: 'Root Admin',
          email: 'root@example.com',
          role: UserRole.SUPER_ADMIN,
          workspaceId: null,
          teamId: null,
          sponsorId: null,
          homePath: '/admin',
          workspace: null,
          team: null,
          sponsor: null,
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
