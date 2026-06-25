import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AccountType, TeamType, UserRole } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { CommercialProfileService } from './commercial-profile.service';

describe('CommercialProfileService', () => {
  const buildService = (prisma: Record<string, unknown>) =>
    new CommercialProfileService(prisma as unknown as PrismaService);

  const baseProfile = {
    id: 'profile-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    sponsorId: 'sponsor-1',
    vertical: 'beauty_aesthetics',
    industry: 'salon',
    businessModel: 'service_provider',
    legacyNiche: 'beauty',
    presetVersion: 'v2',
    blueprintKey: 'blueprint.beauty_aesthetics.v1',
    blueprintVersion: 'v1',
    businessName: 'Ana Studio',
    mainProduct: null,
    averagePrice: null,
    salesMotion: null,
    country: 'México',
    phone: '+5215555555555',
    createdAt: new Date('2026-06-25T00:00:00.000Z'),
    updatedAt: new Date('2026-06-25T00:00:00.000Z'),
  };

  it('upserts a durable profile for an individual account', async () => {
    const tx = {
      commercialProfile: {
        upsert: jest.fn().mockResolvedValue(baseProfile),
      },
    };
    const service = buildService({});

    await service.upsertCommercialProfileForIndividualAccount(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
      },
      {
        businessName: 'Ana Studio',
        niche: 'beauty',
        country: 'México',
        phone: '+5215555555555',
      },
      tx as never,
    );

    expect(tx.commercialProfile.upsert).toHaveBeenCalledWith({
      where: {
        teamId: 'team-1',
      },
      create: expect.objectContaining({
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
        vertical: 'beauty_aesthetics',
        industry: 'salon',
        businessModel: 'service_provider',
        legacyNiche: 'beauty',
        presetVersion: 'v2',
        blueprintKey: 'blueprint.beauty_aesthetics.v1',
        blueprintVersion: 'v1',
        businessName: 'Ana Studio',
        country: 'México',
        phone: '+5215555555555',
      }),
      update: expect.objectContaining({
        workspaceId: 'workspace-1',
        sponsorId: 'sponsor-1',
        blueprintKey: 'blueprint.beauty_aesthetics.v1',
      }),
    });
  });

  it('gets the current profile snapshot and completion state', async () => {
    const service = buildService({
      commercialProfile: {
        findUnique: jest.fn().mockResolvedValue(baseProfile),
      },
    });

    await expect(
      service.getCommercialProfileSnapshotForTeam('team-1'),
    ).resolves.toEqual({
      profile: baseProfile,
      isComplete: true,
    });
  });

  it('updates an existing profile and recalculates the blueprint', async () => {
    const prisma = {
      commercialProfile: {
        findUnique: jest.fn().mockResolvedValue(baseProfile),
        update: jest.fn().mockResolvedValue({
          ...baseProfile,
          vertical: 'real_estate',
          industry: 'residential',
          businessModel: 'service_provider',
          blueprintKey: 'blueprint.real_estate.v1',
        }),
      },
    };
    const service = buildService(prisma);

    await service.updateCommercialProfileForTeam('team-1', {
      vertical: 'real_estate',
      industry: 'residential',
      businessModel: 'service_provider',
    });

    expect(prisma.commercialProfile.update).toHaveBeenCalledWith({
      where: {
        teamId: 'team-1',
      },
      data: expect.objectContaining({
        vertical: 'real_estate',
        industry: 'residential',
        businessModel: 'service_provider',
        blueprintKey: 'blueprint.real_estate.v1',
        blueprintVersion: 'v1',
      }),
    });
  });

  it('maps nutrition and wellness to the health wellness blueprint when form fields are still other', async () => {
    const prisma = {
      commercialProfile: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseProfile,
          vertical: 'other',
          industry: 'other',
          businessModel: 'other',
          legacyNiche: 'other',
          blueprintKey: 'blueprint.other.v1',
        }),
        update: jest.fn().mockResolvedValue({
          ...baseProfile,
          vertical: 'health_wellness',
          industry: 'nutrition',
          businessModel: 'advisor',
          legacyNiche: 'nutrition_wellness',
          blueprintKey: 'blueprint.health_wellness.v1',
        }),
      },
    };
    const service = buildService(prisma);

    await service.updateCommercialProfileForTeam('team-1', {
      businessName: 'Margarita Wellness',
      niche: 'nutrition_wellness',
      vertical: 'other',
      industry: 'other',
      businessModel: 'other',
    });

    expect(prisma.commercialProfile.update).toHaveBeenCalledWith({
      where: {
        teamId: 'team-1',
      },
      data: expect.objectContaining({
        vertical: 'health_wellness',
        industry: 'nutrition',
        businessModel: 'advisor',
        legacyNiche: 'nutrition_wellness',
        blueprintKey: 'blueprint.health_wellness.v1',
        blueprintVersion: 'v1',
      }),
    });
  });

  it('treats other taxonomy values as incomplete', () => {
    const service = buildService({});

    expect(
      service.isCommercialProfileComplete({
        ...baseProfile,
        vertical: 'other',
        industry: 'other',
        businessModel: 'other',
        blueprintKey: 'blueprint.other.v1',
      }),
    ).toBe(false);
  });

  it('creates a profile on update when the team has no profile yet', async () => {
    const prisma = {
      commercialProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(baseProfile),
      },
      team: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'team-1',
          name: 'Ana Studio',
          workspaceId: 'workspace-1',
          sponsors: [{ id: 'sponsor-1' }],
        }),
      },
    };
    const service = buildService(prisma);

    await service.updateCommercialProfileForTeam('team-1', {
      businessName: 'Ana Studio',
      niche: 'real_estate',
    });

    expect(prisma.commercialProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
        businessName: 'Ana Studio',
        vertical: 'real_estate',
        blueprintKey: 'blueprint.real_estate.v1',
      }),
    });
  });

  it('rejects invalid sales motions', async () => {
    const service = buildService({
      commercialProfile: {
        findUnique: jest.fn().mockResolvedValue(baseProfile),
      },
    });

    await expect(
      service.updateCommercialProfileForTeam('team-1', {
        salesMotion: 'email_only',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks /me outside an individual personal team context', async () => {
    const service = buildService({
      team: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'team-1',
          workspaceId: 'workspace-1',
          teamType: TeamType.commercial_team,
          workspace: {
            accountType: AccountType.team,
          },
        }),
      },
    });

    await expect(
      service.assertCurrentTeamSupportsCommercialProfile({
        id: 'user-1',
        fullName: 'Ana',
        email: 'ana@example.com',
        role: UserRole.TEAM_ADMIN,
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
        homePath: '/member',
        workspace: null,
        team: null,
        sponsor: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
