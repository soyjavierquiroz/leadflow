import { BadRequestException, ConflictException } from '@nestjs/common';
import { AccountType, TeamType, UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { AccountProvisioningService } from './account-provisioning.service';

describe('AccountProvisioningService', () => {
  const buildService = (tx: Record<string, unknown>) => {
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const mailService = {
      sendWelcomeEmail: jest.fn(),
    };
    const commercialProfileService = {
      upsertCommercialProfileForIndividualAccount: jest.fn().mockResolvedValue({
        id: 'commercial-profile-1',
      }),
    };

    return {
      commercialProfileService,
      mailService,
      prisma,
      service: new AccountProvisioningService(
        prisma,
        mailService as never,
        commercialProfileService as never,
      ),
    };
  };

  const baseUser = {
    id: 'user-1',
    workspaceId: null,
    teamId: null,
    sponsorId: null,
    fullName: 'Ana Owner',
    email: 'ana@example.com',
    passwordHash: 'hash',
    resetToken: null,
    resetTokenExpires: null,
    role: UserRole.MEMBER,
    status: UserStatus.active,
    lastLoginAt: null,
    createdAt: new Date('2026-06-24T00:00:00.000Z'),
    updatedAt: new Date('2026-06-24T00:00:00.000Z'),
    workspace: null,
    team: null,
    sponsor: null,
  };

  it('creates an individual workspace, personal team, owner sponsor, TEAM_ADMIN user and fallback rotation pool', async () => {
    const workspace = {
      id: 'workspace-1',
      name: 'Ana Studio',
      slug: 'ana-studio-user-1',
      status: 'active',
      accountType: AccountType.individual,
      timezone: 'UTC',
      defaultCurrency: 'USD',
      primaryLocale: 'es',
      primaryDomain: null,
      emailNotificationsEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const team = {
      id: 'team-1',
      workspaceId: workspace.id,
      name: 'Ana Studio',
      code: 'ana-studio-user-1',
      logoUrl: null,
      status: 'active',
      teamType: TeamType.personal,
      isActive: true,
      lastAssignedUserId: null,
      subscriptionExpiresAt: null,
      description: null,
      managerUserId: null,
      maxSeats: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const sponsor = {
      id: 'sponsor-1',
      workspaceId: workspace.id,
      teamId: team.id,
      displayName: 'Ana Owner',
      publicSlug: 'ana-owner',
      status: 'active',
      isActive: true,
      avatarUrl: null,
      email: 'ana@example.com',
      phone: '+59170000000',
      availabilityStatus: 'available',
      routingWeight: 1,
      memberPortalEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(baseUser),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(workspace),
      },
      team: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(team),
        update: jest.fn().mockResolvedValue({}),
      },
      sponsor: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(sponsor),
      },
      rotationPool: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pool-1' }),
      },
      rotationMember: {
        create: jest.fn(),
      },
    };
    const { commercialProfileService, service } = buildService(tx);

    const result = await service.provisionIndividualAccount(
      { id: baseUser.id },
      {
        businessName: 'Ana Studio',
        phone: '+59170000000',
      },
    );

    expect(result).toEqual({
      workspaceId: workspace.id,
      teamId: team.id,
      sponsorId: sponsor.id,
      userId: baseUser.id,
      niche: 'other',
      commercialProfile: {
        vertical: 'other',
        industry: 'other',
        businessModel: 'other',
        legacyNiche: 'other',
        presetVersion: 'v2',
        blueprintKey: 'blueprint.other.v1',
        blueprintVersion: 'v1',
      },
      accountType: 'individual',
      teamType: 'personal',
    });
    expect(tx.workspace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountType: AccountType.individual,
        name: 'Ana Studio',
      }),
    });
    expect(tx.team.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: workspace.id,
        teamType: TeamType.personal,
        maxSeats: 1,
      }),
    });
    expect(tx.sponsor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: workspace.id,
        teamId: team.id,
        email: 'ana@example.com',
        phone: '+59170000000',
        isActive: true,
        availabilityStatus: 'available',
      }),
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: expect.objectContaining({
        workspaceId: workspace.id,
        teamId: team.id,
        sponsorId: sponsor.id,
        role: UserRole.TEAM_ADMIN,
      }),
    });
    expect(tx.rotationPool.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: workspace.id,
        teamId: team.id,
        status: 'active',
        strategy: 'round_robin',
        isFallbackPool: true,
      }),
    });
    expect(
      commercialProfileService.upsertCommercialProfileForIndividualAccount,
    ).toHaveBeenCalledWith(
      {
        workspaceId: workspace.id,
        teamId: team.id,
        sponsorId: sponsor.id,
      },
      {
        businessName: 'Ana Studio',
        niche: 'other',
        country: undefined,
        phone: '+59170000000',
      },
      tx,
    );
  });

  it('returns an existing individual context without duplicating workspace, team or sponsor', async () => {
    const existingUser = {
      ...baseUser,
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      sponsorId: 'sponsor-1',
      role: UserRole.TEAM_ADMIN,
      workspace: {
        id: 'workspace-1',
        name: 'Ana Studio',
        slug: 'ana-studio',
        status: 'active',
        accountType: AccountType.individual,
        timezone: 'UTC',
        defaultCurrency: 'USD',
        primaryLocale: 'es',
        primaryDomain: null,
        emailNotificationsEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      team: {
        id: 'team-1',
        workspaceId: 'workspace-1',
        name: 'Ana Studio',
        code: 'ana-studio',
        logoUrl: null,
        status: 'active',
        teamType: TeamType.personal,
        isActive: true,
        lastAssignedUserId: null,
        subscriptionExpiresAt: null,
        description: null,
        managerUserId: 'user-1',
        maxSeats: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      sponsor: {
        id: 'sponsor-1',
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        displayName: 'Ana Owner',
        publicSlug: 'ana-owner',
        status: 'active',
        isActive: true,
        avatarUrl: null,
        email: 'ana@example.com',
        phone: '+59170000000',
        availabilityStatus: 'available',
        routingWeight: 1,
        memberPortalEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(existingUser),
        update: jest.fn(),
      },
      workspace: {
        create: jest.fn(),
      },
      team: {
        create: jest.fn(),
        update: jest.fn(),
      },
      sponsor: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(existingUser.sponsor),
        update: jest.fn(),
        create: jest.fn(),
      },
      rotationPool: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pool-1',
          members: [{ sponsorId: 'sponsor-1' }],
        }),
        create: jest.fn(),
      },
      rotationMember: {
        create: jest.fn(),
      },
    };
    const { commercialProfileService, service } = buildService(tx);

    const result = await service.provisionIndividualAccount(
      { id: existingUser.id },
      { businessName: 'Ana Studio' },
    );

    expect(result).toMatchObject({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      sponsorId: 'sponsor-1',
      accountType: 'individual',
      teamType: 'personal',
    });
    expect(tx.workspace.create).not.toHaveBeenCalled();
    expect(tx.team.create).not.toHaveBeenCalled();
    expect(tx.sponsor.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.rotationPool.create).not.toHaveBeenCalled();
    expect(
      commercialProfileService.upsertCommercialProfileForIndividualAccount,
    ).toHaveBeenCalledTimes(1);
  });

  it('does not modify a user that already belongs to a team tenant', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseUser,
          workspaceId: 'workspace-team-1',
          teamId: 'team-commercial-1',
          workspace: {
            accountType: AccountType.team,
          },
          team: {
            teamType: TeamType.commercial_team,
          },
        }),
      },
      workspace: {
        create: jest.fn(),
      },
      team: {
        create: jest.fn(),
      },
      sponsor: {
        create: jest.fn(),
      },
    };
    const { service } = buildService(tx);

    await expect(
      service.provisionIndividualAccount(
        { id: baseUser.id },
        { businessName: 'Ana Studio' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.workspace.create).not.toHaveBeenCalled();
    expect(tx.team.create).not.toHaveBeenCalled();
    expect(tx.sponsor.create).not.toHaveBeenCalled();
  });

  it('keeps SUPER_ADMIN role when provisioning an individual context for an existing super admin user', async () => {
    const workspace = {
      id: 'workspace-1',
      accountType: AccountType.individual,
    };
    const team = {
      id: 'team-1',
      workspaceId: 'workspace-1',
      teamType: TeamType.personal,
      managerUserId: null,
    };
    const sponsor = {
      id: 'sponsor-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
    };
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseUser,
          role: UserRole.SUPER_ADMIN,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(workspace),
      },
      team: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(team),
        update: jest.fn().mockResolvedValue({}),
      },
      sponsor: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(sponsor),
      },
      rotationPool: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pool-1',
          members: [{ sponsorId: 'sponsor-1' }],
        }),
      },
      rotationMember: {
        create: jest.fn(),
      },
    };
    const { service } = buildService(tx);

    await service.provisionIndividualAccount(
      { id: baseUser.id },
      { businessName: 'Ana Studio' },
    );

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: expect.objectContaining({
        role: UserRole.SUPER_ADMIN,
      }),
    });
  });

  it('rejects an empty business name', async () => {
    const { service } = buildService({});

    await expect(
      service.provisionIndividualAccount({ id: baseUser.id }, {
        businessName: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a complete individual account for Super Admin provisioning', async () => {
    const workspace = {
      id: 'workspace-1',
      name: 'Ana Studio',
      slug: 'ana-studio-user-1',
      status: 'active',
      accountType: AccountType.individual,
      timezone: 'UTC',
      defaultCurrency: 'USD',
      primaryLocale: 'es',
      primaryDomain: null,
      emailNotificationsEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const team = {
      id: 'team-1',
      workspaceId: workspace.id,
      name: 'Ana Studio',
      code: 'ana-studio-user-1',
      logoUrl: null,
      status: 'active',
      teamType: TeamType.personal,
      isActive: true,
      lastAssignedUserId: null,
      subscriptionExpiresAt: null,
      description: null,
      managerUserId: null,
      maxSeats: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const sponsor = {
      id: 'sponsor-1',
      workspaceId: workspace.id,
      teamId: team.id,
      displayName: 'Ana Owner',
      publicSlug: 'ana-owner',
      status: 'active',
      isActive: true,
      avatarUrl: null,
      email: 'ana@example.com',
      phone: '+59170000000',
      availabilityStatus: 'available',
      routingWeight: 1,
      memberPortalEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const createdUser = {
      ...baseUser,
      id: 'user-1',
      fullName: 'Ana Owner',
      email: 'ana@example.com',
      role: UserRole.TEAM_ADMIN,
    };
    const tx = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdUser),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: createdUser.id }),
        update: jest.fn().mockResolvedValue({}),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(workspace),
      },
      team: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(team),
        update: jest.fn().mockResolvedValue({}),
      },
      sponsor: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(sponsor),
      },
      rotationPool: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pool-1' }),
      },
      rotationMember: {
        create: jest.fn(),
      },
    };
    const { commercialProfileService, mailService, service } = buildService(tx);

    const result = await service.createSystemIndividualAccount({
      name: 'Ana Owner',
      email: ' ANA@EXAMPLE.COM ',
      businessName: 'Ana Studio',
      niche: 'beauty',
      phone: '+59170000000',
      temporaryPassword: 'TempPass123',
      sendInviteEmail: true,
    });

    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fullName: 'Ana Owner',
        email: 'ana@example.com',
        role: UserRole.TEAM_ADMIN,
        status: UserStatus.active,
      }),
      select: {
        id: true,
      },
    });
    expect(tx.workspace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountType: AccountType.individual,
        name: 'Ana Studio',
      }),
    });
    expect(tx.team.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamType: TeamType.personal,
        maxSeats: 1,
      }),
    });
    expect(tx.sponsor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'ana@example.com',
        phone: '+59170000000',
        status: 'active',
        isActive: true,
      }),
    });
    expect(mailService.sendWelcomeEmail).toHaveBeenCalledWith(
      'ana@example.com',
      'TempPass123',
      'Ana Studio',
    );
    expect(
      commercialProfileService.upsertCommercialProfileForIndividualAccount,
    ).toHaveBeenCalledWith(
      {
        workspaceId: workspace.id,
        teamId: team.id,
        sponsorId: sponsor.id,
      },
      {
        businessName: 'Ana Studio',
        niche: 'beauty',
        country: undefined,
        phone: '+59170000000',
      },
      tx,
    );
    expect(result).toEqual({
      workspaceId: workspace.id,
      teamId: team.id,
      sponsorId: sponsor.id,
      userId: createdUser.id,
      niche: 'beauty',
      commercialProfile: {
        vertical: 'beauty_aesthetics',
        industry: 'salon',
        businessModel: 'service_provider',
        legacyNiche: 'beauty',
        presetVersion: 'v2',
        blueprintKey: 'blueprint.beauty_aesthetics.v1',
        blueprintVersion: 'v1',
      },
      accountType: 'individual',
      teamType: 'personal',
      email: 'ana@example.com',
      temporaryPassword: 'TempPass123',
      loginUrl: '/login',
      recommendedRedirect: '/member/crm',
    });
  });

  it('rejects a duplicate email when Super Admin creates an individual account', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing-user' }),
        create: jest.fn(),
      },
      workspace: {
        create: jest.fn(),
      },
      team: {
        create: jest.fn(),
      },
      sponsor: {
        create: jest.fn(),
      },
    };
    const { service } = buildService(tx);

    await expect(
      service.createSystemIndividualAccount({
        name: 'Ana Owner',
        email: 'ana@example.com',
        businessName: 'Ana Studio',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.workspace.create).not.toHaveBeenCalled();
    expect(tx.team.create).not.toHaveBeenCalled();
    expect(tx.sponsor.create).not.toHaveBeenCalled();
  });
});
