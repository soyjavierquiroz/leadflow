import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { CommercialProfileService } from '../commercial-profile/commercial-profile.service';
import { FunnelArsenalService } from './funnel-arsenal.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  fullName: 'Ana Owner',
  email: 'ana@example.com',
  role: UserRole.TEAM_ADMIN,
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  sponsorId: 'sponsor-1',
  homePath: '/member',
  workspace: {
    id: 'workspace-1',
    name: 'Ana Studio',
    slug: 'ana-studio',
    primaryDomain: null,
  },
  team: {
    id: 'team-1',
    name: 'Ana Studio',
    code: 'ana-studio',
  },
  sponsor: {
    id: 'sponsor-1',
    displayName: 'Ana',
    email: 'ana@example.com',
    isActive: true,
    availabilityStatus: 'available',
  },
};

const beautyProfile = {
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
  country: null,
  phone: null,
  createdAt: new Date('2026-06-25T00:00:00.000Z'),
  updatedAt: new Date('2026-06-25T00:00:00.000Z'),
};

const buildCommercialProfileService = (profile: typeof beautyProfile | null) =>
  ({
    assertCurrentTeamSupportsCommercialProfile: jest
      .fn()
      .mockResolvedValue(undefined),
    getCommercialProfileForTeam: jest.fn().mockResolvedValue(profile),
  }) as unknown as CommercialProfileService;

const buildService = (
  prisma: Record<string, unknown>,
  commercialProfileService: CommercialProfileService,
) =>
  new FunnelArsenalService(
    prisma as unknown as PrismaService,
    commercialProfileService,
  );

describe('FunnelArsenalService', () => {
  it('lists the arsenal for the current blueprint and marks enabled templates', async () => {
    const commercialProfileService =
      buildCommercialProfileService(beautyProfile);
    const prisma = {
      funnelPublication: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'publication-1',
            pathPrefix: '/diagnostico-belleza',
            domain: { host: 'ana.example.com' },
            funnelInstance: {
              code: 'arsenal-beauty-aesthetics-diagnosis-booking',
            },
          },
        ]),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(service.listForCurrentTeam(user)).resolves.toMatchObject({
      blueprintKey: 'blueprint.beauty_aesthetics.v1',
      templates: [
        {
          templateKey: 'beauty-aesthetics-diagnosis-booking',
          enabled: true,
          publicationId: 'publication-1',
          publicUrl: 'https://ana.example.com/diagnostico-belleza',
        },
      ],
    });
  });

  it('falls back to the other blueprint when there is no commercial profile', async () => {
    const commercialProfileService = buildCommercialProfileService(null);
    const prisma = {
      funnelPublication: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(service.listForCurrentTeam(user)).resolves.toMatchObject({
      blueprintKey: 'blueprint.other.v1',
      templates: [
        {
          templateKey: 'other-more-information',
          enabled: false,
        },
      ],
    });
  });

  it('creates a publication for an available template without touching CRM, ownership, tracking or automation models', async () => {
    const commercialProfileService =
      buildCommercialProfileService(beautyProfile);
    const tx = {
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'publication-1',
          pathPrefix: '/diagnostico-belleza',
          domain: { host: 'ana.example.com' },
        }),
      },
      funnelTemplate: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'template-1' }),
      },
      funnel: {
        create: jest.fn().mockResolvedValue({ id: 'funnel-1' }),
      },
      funnelInstance: {
        create: jest.fn().mockResolvedValue({ id: 'instance-1' }),
      },
      funnelStep: {
        create: jest.fn().mockResolvedValue({ id: 'step-1' }),
      },
    };
    const prisma = {
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      domain: {
        findFirst: jest.fn().mockResolvedValue({ id: 'domain-1' }),
      },
      crmLeadAssignment: {
        create: jest.fn(),
      },
      assignment: {
        create: jest.fn(),
      },
      trackingProfile: {
        create: jest.fn(),
      },
      automationDispatch: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = buildService(prisma, commercialProfileService);

    const result = await service.enableForCurrentTeam(
      user,
      'beauty-aesthetics-diagnosis-booking',
    );

    expect(result).toMatchObject({
      enabled: true,
      publicationId: 'publication-1',
      publicUrl: 'https://ana.example.com/diagnostico-belleza',
    });
    expect(tx.funnelPublication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trackingProfileId: null,
          handoffStrategyId: null,
          metaPixelId: null,
          tiktokPixelId: null,
          metaCapiToken: null,
          tiktokAccessToken: null,
          pathPrefix: '/diagnostico-belleza',
          status: 'active',
          isActive: true,
        }),
      }),
    );
    expect(tx.funnelInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trackingProfileId: null,
          handoffStrategyId: null,
          code: 'arsenal-beauty-aesthetics-diagnosis-booking',
        }),
      }),
    );
    expect(prisma.crmLeadAssignment.create).not.toHaveBeenCalled();
    expect(prisma.assignment.create).not.toHaveBeenCalled();
    expect(prisma.trackingProfile.create).not.toHaveBeenCalled();
    expect(prisma.automationDispatch.create).not.toHaveBeenCalled();
  });

  it('returns the existing publication when enable is called again', async () => {
    const commercialProfileService =
      buildCommercialProfileService(beautyProfile);
    const prisma = {
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'publication-1',
          pathPrefix: '/diagnostico-belleza',
          domain: { host: 'ana.example.com' },
        }),
      },
      domain: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(
      service.enableForCurrentTeam(user, 'beauty-aesthetics-diagnosis-booking'),
    ).resolves.toMatchObject({
      publicationId: 'publication-1',
      publicUrl: 'https://ana.example.com/diagnostico-belleza',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.domain.findFirst).not.toHaveBeenCalled();
  });

  it('rejects templates from another blueprint', async () => {
    const commercialProfileService =
      buildCommercialProfileService(beautyProfile);
    const prisma = {
      funnelPublication: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(
      service.enableForCurrentTeam(user, 'mlm-opportunity-presentation'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
