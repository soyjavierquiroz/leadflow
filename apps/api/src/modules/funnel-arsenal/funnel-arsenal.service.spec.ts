import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
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

const healthWellnessProfile = {
  ...beautyProfile,
  id: 'profile-health-1',
  vertical: 'health_wellness',
  industry: 'nutrition',
  businessModel: 'advisor',
  legacyNiche: 'nutrition_wellness',
  blueprintKey: 'blueprint.health_wellness.v1',
  businessName: 'Margarita Wellness',
};

const mlmProfile = {
  ...beautyProfile,
  id: 'profile-mlm-1',
  vertical: 'mlm',
  industry: 'nutrition_mlm',
  businessModel: 'distributor',
  legacyNiche: 'nutrition_wellness',
  blueprintKey: 'blueprint.mlm.v1',
  businessName: 'Margarita Network',
};

const dbHealthTemplate = {
  id: 'arsenal-template-db-1',
  templateKey: 'health-wellness-evaluation',
  blueprintKey: 'blueprint.health_wellness.v1',
  vertical: 'health_wellness',
  label: 'Evaluación DB de bienestar',
  description: 'Template administrado desde DB.',
  goal: 'Capturar solicitudes de evaluación desde DB.',
  recommendedFor: 'Nutrición y bienestar.',
  cta: 'Quiero evaluación DB',
  pathSuggestion: '/evaluacion-db',
  difficulty: 'basic',
  status: 'active',
  blocksPresetKey: 'basic-lead-capture',
  funnelTemplateId: null,
  sourceFunnelId: null,
  sourceFunnelInstanceId: null,
  createdAt: new Date('2026-06-25T00:00:00.000Z'),
  updatedAt: new Date('2026-06-25T00:00:00.000Z'),
};

const buildCommercialProfileService = (
  profile: Record<string, unknown> | null,
) =>
  ({
    assertCurrentTeamSupportsCommercialProfile: jest
      .fn()
      .mockResolvedValue(undefined),
    getCommercialProfileForTeam: jest.fn().mockResolvedValue(profile),
    isCommercialProfileComplete: jest
      .fn()
      .mockImplementation((current) =>
        Boolean(
          current?.businessName &&
          current.vertical &&
          current.vertical !== 'other' &&
          current.industry &&
          current.industry !== 'other' &&
          current.businessModel &&
          current.businessModel !== 'other' &&
          current.blueprintKey,
        ),
      ),
  }) as unknown as CommercialProfileService;

const buildService = (
  prisma: Record<string, unknown>,
  commercialProfileService: CommercialProfileService,
  funnelMasterClonerService: Record<string, unknown> = {},
) => {
  const defaultFunnelArsenalTemplate = {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  };
  const mergedPrisma = {
    ...prisma,
    funnelArsenalTemplate: {
      ...defaultFunnelArsenalTemplate,
      ...((prisma.funnelArsenalTemplate as Record<string, unknown>) ?? {}),
    },
    funnelInstance: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'source-instance-1' }),
      ...((prisma.funnelInstance as Record<string, unknown>) ?? {}),
    },
  };

  return new FunnelArsenalService(
    mergedPrisma as unknown as PrismaService,
    commercialProfileService,
    {
      resolvePublicationTarget: jest.fn(async (_tx, input) => ({
        domainId: 'domain-1',
        pathPrefix: input.requestedPath,
      })),
      cloneMasterFunnelInstanceToTeamInTransaction: jest.fn(),
      ...funnelMasterClonerService,
    } as never,
  );
};

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
      requiresCommercialProfile: false,
      templates: [
        {
          templateKey: 'beauty-aesthetics-diagnosis-booking',
          enabled: true,
          publicationId: 'publication-1',
          publicUrl: 'https://ana.example.com/diagnostico-belleza',
        },
      ],
    });
    expect(prisma.funnelPublication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: 'team-1',
          status: 'active',
          isActive: true,
          NOT: {
            pathPrefix: {
              startsWith: '/ref/',
            },
          },
        }),
      }),
    );
  });

  it('lists health and wellness templates for the health wellness blueprint', async () => {
    const commercialProfileService = buildCommercialProfileService(
      healthWellnessProfile,
    );
    const prisma = {
      funnelPublication: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(service.listForCurrentTeam(user)).resolves.toMatchObject({
      blueprintKey: 'blueprint.health_wellness.v1',
      requiresCommercialProfile: false,
      templates: [
        {
          templateKey: 'health-wellness-evaluation',
          label: 'Evaluación de bienestar',
          enabled: false,
        },
      ],
    });
  });

  it('lists MLM templates for the MLM blueprint', async () => {
    const commercialProfileService = buildCommercialProfileService(mlmProfile);
    const prisma = {
      funnelPublication: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(service.listForCurrentTeam(user)).resolves.toMatchObject({
      blueprintKey: 'blueprint.mlm.v1',
      requiresCommercialProfile: false,
      templates: [
        {
          templateKey: 'mlm-opportunity-presentation',
          label: 'Presentación de oportunidad',
          enabled: false,
        },
      ],
    });
  });

  it('uses active DB templates before static fallback', async () => {
    const commercialProfileService = buildCommercialProfileService(
      healthWellnessProfile,
    );
    const prisma = {
      funnelArsenalTemplate: {
        findMany: jest.fn().mockResolvedValue([dbHealthTemplate]),
      },
      funnelPublication: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(service.listForCurrentTeam(user)).resolves.toMatchObject({
      blueprintKey: 'blueprint.health_wellness.v1',
      templates: [
        {
          templateKey: 'health-wellness-evaluation',
          label: 'Evaluación DB de bienestar',
          enabled: false,
        },
      ],
    });
    expect(prisma.funnelArsenalTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          blueprintKey: 'blueprint.health_wellness.v1',
          status: 'active',
        },
      }),
    );
  });

  it('requires a commercial profile instead of falling back to other', async () => {
    const commercialProfileService = buildCommercialProfileService(null);
    const prisma = {
      funnelPublication: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(service.listForCurrentTeam(user)).resolves.toMatchObject({
      blueprintKey: null,
      requiresCommercialProfile: true,
      templates: [],
    });
    expect(prisma.funnelPublication.findMany).not.toHaveBeenCalled();
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
    expect(result.publicUrl).not.toContain('/ref/');
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

  it('enables a DB template when the template key exists in the admin arsenal', async () => {
    const commercialProfileService = buildCommercialProfileService(
      healthWellnessProfile,
    );
    const tx = {
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'publication-db-1',
          pathPrefix: '/evaluacion-db',
          domain: { host: 'margarita.example.com' },
        }),
      },
      funnelTemplate: {
        findUnique: jest.fn().mockResolvedValue({ id: 'template-1' }),
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
      funnelArsenalTemplate: {
        findFirst: jest.fn().mockResolvedValue(dbHealthTemplate),
      },
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      domain: {
        findFirst: jest.fn().mockResolvedValue({ id: 'domain-1' }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = buildService(prisma, commercialProfileService);

    const result = await service.enableForCurrentTeam(
      user,
      'health-wellness-evaluation',
    );

    expect(result).toMatchObject({
      label: 'Evaluación DB de bienestar',
      publicUrl: 'https://margarita.example.com/evaluacion-db',
    });
    expect(tx.funnel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Evaluación DB de bienestar',
        }),
      }),
    );
  });

  it('falls back to static templates when no active DB template exists for enable', async () => {
    const commercialProfileService = buildCommercialProfileService(
      healthWellnessProfile,
    );
    const tx = {
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'publication-static-1',
          pathPrefix: '/evaluacion',
          domain: { host: 'margarita.example.com' },
        }),
      },
      funnelTemplate: {
        findUnique: jest.fn().mockResolvedValue({ id: 'template-1' }),
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
      funnelArsenalTemplate: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      domain: {
        findFirst: jest.fn().mockResolvedValue({ id: 'domain-1' }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(
      service.enableForCurrentTeam(user, 'health-wellness-evaluation'),
    ).resolves.toMatchObject({
      label: 'Evaluación de bienestar',
      publicUrl: 'https://margarita.example.com/evaluacion',
    });
  });

  it('clones the source FunnelInstance when the DB template has a source', async () => {
    const commercialProfileService = buildCommercialProfileService(
      healthWellnessProfile,
    );
    const sourceTemplate = {
      ...dbHealthTemplate,
      sourceFunnelInstanceId: 'source-instance-1',
    };
    const tx = {
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const cloneMasterFunnelInstanceToTeamInTransaction = jest
      .fn()
      .mockResolvedValue({
        funnelId: 'cloned-funnel-1',
        funnelInstanceId: 'cloned-instance-1',
        publicationId: 'publication-clone-1',
        publicUrl: 'https://margarita.example.com/evaluacion-db',
        pathPrefix: '/evaluacion-db',
        stepIdMap: {
          'source-step-1': 'cloned-step-1',
        },
      });
    const prisma = {
      funnelArsenalTemplate: {
        findFirst: jest.fn().mockResolvedValue(sourceTemplate),
      },
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      domain: {
        findFirst: jest.fn().mockResolvedValue({ id: 'domain-1' }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = buildService(prisma, commercialProfileService, {
      cloneMasterFunnelInstanceToTeamInTransaction,
    });

    const result = await service.enableForCurrentTeam(
      user,
      'health-wellness-evaluation',
    );

    expect(cloneMasterFunnelInstanceToTeamInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        sourceFunnelInstanceId: 'source-instance-1',
        targetWorkspaceId: 'workspace-1',
        targetTeamId: 'team-1',
        requestedPath: '/evaluacion-db',
        instanceCode: 'arsenal-health-wellness-evaluation',
      }),
    );
    expect(result).toMatchObject({
      enabled: true,
      source: 'master_clone',
      funnelInstanceId: 'cloned-instance-1',
      publicationId: 'publication-clone-1',
      pathPrefix: '/evaluacion-db',
    });
  });

  it('does not return sponsor referral links when enabling a funnel', async () => {
    const commercialProfileService = buildCommercialProfileService(
      healthWellnessProfile,
    );
    const tx = {
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'publication-1',
          pathPrefix: '/evaluacion',
          domain: { host: 'margarita.example.com' },
        }),
      },
      funnelTemplate: {
        findUnique: jest.fn().mockResolvedValue({ id: 'template-1' }),
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
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = buildService(prisma, commercialProfileService);

    const result = await service.enableForCurrentTeam(
      user,
      'health-wellness-evaluation',
    );

    expect(prisma.funnelPublication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: 'team-1',
          NOT: {
            pathPrefix: {
              startsWith: '/ref/',
            },
          },
        }),
      }),
    );
    expect(result.publicUrl).toBe('https://margarita.example.com/evaluacion');
    expect(result.publicUrl).not.toContain('/ref/');
  });

  it('scopes enabled publications to the current user team', async () => {
    const commercialProfileService = buildCommercialProfileService(
      healthWellnessProfile,
    );
    const prisma = {
      funnelPublication: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await service.listForCurrentTeam(user);

    expect(prisma.funnelPublication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: 'team-1',
        }),
      }),
    );
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

  it('lets the system admin create, list, update and archive templates', async () => {
    const commercialProfileService = buildCommercialProfileService(null);
    const created = {
      ...dbHealthTemplate,
      templateKey: 'custom-health-check',
      label: 'Chequeo de salud',
    };
    const updated = {
      ...created,
      label: 'Chequeo de salud editado',
    };
    const archived = {
      ...updated,
      status: 'archived',
    };
    const prisma = {
      funnelArsenalTemplate: {
        findMany: jest.fn().mockResolvedValue([created]),
        create: jest.fn().mockResolvedValue(created),
        findUnique: jest.fn().mockResolvedValue(created),
        update: jest
          .fn()
          .mockResolvedValueOnce(updated)
          .mockResolvedValueOnce(archived),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(service.listSystemTemplates()).resolves.toMatchObject([
      {
        templateKey: 'custom-health-check',
      },
    ]);
    await expect(
      service.createSystemTemplate({
        templateKey: 'custom-health-check',
        blueprintKey: 'blueprint.health_wellness.v1',
        vertical: 'health_wellness',
        label: 'Chequeo de salud',
        description: 'Ficha manual',
        goal: 'Capturar interesados',
        recommendedFor: 'Nutrición',
        cta: 'Quiero el chequeo',
        pathSuggestion: '/chequeo',
        difficulty: 'basic',
        status: 'active',
      }),
    ).resolves.toMatchObject({
      templateKey: 'custom-health-check',
      label: 'Chequeo de salud',
    });
    await expect(
      service.updateSystemTemplate('custom-health-check', {
        label: 'Chequeo de salud editado',
      }),
    ).resolves.toMatchObject({
      label: 'Chequeo de salud editado',
    });
    await expect(
      service.archiveSystemTemplate('custom-health-check'),
    ).resolves.toMatchObject({
      status: 'archived',
    });
  });

  it('creates an internal Master Funnel for a marketplace asset without creating publications or commercial side effects', async () => {
    const commercialProfileService = buildCommercialProfileService(null);
    const marketplaceTemplate = {
      ...dbHealthTemplate,
      assetSlug: 'health-wellness-evaluation',
      funnelFormat: 'vsl',
      sourceFunnelId: null,
      sourceFunnelInstanceId: null,
    };
    const tx = {
      funnelArsenalTemplate: {
        findUnique: jest.fn().mockResolvedValue(marketplaceTemplate),
        update: jest.fn().mockResolvedValue({
          ...marketplaceTemplate,
          sourceFunnelId: 'master-funnel-1',
          sourceFunnelInstanceId: 'master-instance-1',
        }),
      },
      funnelInstance: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'master-instance-1' }),
      },
      funnelTemplate: {
        findUnique: jest.fn().mockResolvedValue({ id: 'base-template-1' }),
      },
      funnel: {
        create: jest.fn().mockResolvedValue({ id: 'master-funnel-1' }),
      },
      funnelStep: {
        create: jest.fn().mockResolvedValue({ id: 'step-1' }),
      },
      funnelPublication: {
        create: jest.fn(),
      },
      domain: {
        create: jest.fn(),
      },
    };
    const prisma = {
      workspace: {
        upsert: jest.fn().mockResolvedValue({ id: 'arsenal-workspace-1' }),
      },
      team: {
        upsert: jest.fn().mockResolvedValue({ id: 'arsenal-team-1' }),
      },
      funnelArsenalTemplate: {
        findFirst: jest.fn().mockResolvedValue(marketplaceTemplate),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
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
    };
    const service = buildService(prisma, commercialProfileService);

    const result = await service.createSystemMarketplaceMasterFunnel(
      'health-wellness-evaluation',
    );

    expect(result).toEqual({
      sourceFunnelInstanceId: 'master-instance-1',
      sourceFunnelId: 'master-funnel-1',
      builderUrl:
        '/admin/tenants/arsenal-team-1/funnels/master-funnel-1/builder',
      workspaceId: 'arsenal-workspace-1',
      teamId: 'arsenal-team-1',
    });
    expect(tx.funnel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'arsenal-workspace-1',
          defaultTeamId: 'arsenal-team-1',
          name: 'Evaluación DB de bienestar — Master',
          code: 'master-health-wellness-evaluation',
          status: 'draft',
          config: expect.objectContaining({
            isMasterFunnel: true,
            source: 'funnel_marketplace_master',
            blueprintKey: 'blueprint.health_wellness.v1',
            vertical: 'health_wellness',
          }),
        }),
      }),
    );
    expect(tx.funnelInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'arsenal-workspace-1',
          teamId: 'arsenal-team-1',
          status: 'draft',
          code: 'master-health-wellness-evaluation',
          rotationPoolId: null,
          trackingProfileId: null,
          handoffStrategyId: null,
        }),
      }),
    );
    expect(tx.funnelStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepType: 'landing',
          slug: 'captura',
        }),
      }),
    );
    expect(tx.funnelStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepType: 'presentation',
          slug: 'presentacion',
        }),
      }),
    );
    expect(tx.funnelStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepType: 'thank_you',
          slug: 'confirmacion',
        }),
      }),
    );
    expect(tx.funnelArsenalTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          sourceFunnelInstanceId: 'master-instance-1',
          sourceFunnelId: 'master-funnel-1',
        },
      }),
    );
    expect(tx.funnelPublication.create).not.toHaveBeenCalled();
    expect(tx.domain.create).not.toHaveBeenCalled();
    expect(prisma.crmLeadAssignment.create).not.toHaveBeenCalled();
    expect(prisma.assignment.create).not.toHaveBeenCalled();
    expect(prisma.trackingProfile.create).not.toHaveBeenCalled();
    expect(prisma.automationDispatch.create).not.toHaveBeenCalled();
  });

  it('returns the existing Master Funnel when the marketplace asset is already associated', async () => {
    const commercialProfileService = buildCommercialProfileService(null);
    const marketplaceTemplate = {
      ...dbHealthTemplate,
      assetSlug: 'health-wellness-evaluation',
      sourceFunnelId: 'master-funnel-1',
      sourceFunnelInstanceId: 'master-instance-1',
    };
    const prisma = {
      workspace: {
        upsert: jest.fn(),
      },
      team: {
        upsert: jest.fn(),
      },
      funnelArsenalTemplate: {
        findFirst: jest.fn().mockResolvedValue(marketplaceTemplate),
        update: jest.fn(),
      },
      funnelInstance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'master-instance-1',
          workspaceId: 'arsenal-workspace-1',
          teamId: 'arsenal-team-1',
          funnelId: 'master-funnel-1',
        }),
      },
      $transaction: jest.fn(),
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(
      service.createSystemMarketplaceMasterFunnel('health-wellness-evaluation'),
    ).resolves.toEqual({
      sourceFunnelInstanceId: 'master-instance-1',
      sourceFunnelId: 'master-funnel-1',
      builderUrl:
        '/admin/tenants/arsenal-team-1/funnels/master-funnel-1/builder',
      workspaceId: 'arsenal-workspace-1',
      teamId: 'arsenal-team-1',
    });
    expect(prisma.workspace.upsert).not.toHaveBeenCalled();
    expect(prisma.team.upsert).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('normalizes stale sourceFunnelId and returns a Builder URL with the linked Funnel.id', async () => {
    const commercialProfileService = buildCommercialProfileService(null);
    const marketplaceTemplate = {
      ...dbHealthTemplate,
      assetSlug: 'health-wellness-evaluation',
      sourceFunnelId: 'stale-instance-or-funnel-id',
      sourceFunnelInstanceId: 'master-instance-1',
    };
    const prisma = {
      funnelArsenalTemplate: {
        findFirst: jest.fn().mockResolvedValue(marketplaceTemplate),
        update: jest.fn(),
      },
      funnelInstance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'master-instance-1',
          workspaceId: 'arsenal-workspace-1',
          teamId: 'arsenal-team-1',
          funnelId: 'master-funnel-real-id',
        }),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(
      service.createSystemMarketplaceMasterFunnel('health-wellness-evaluation'),
    ).resolves.toMatchObject({
      sourceFunnelInstanceId: 'master-instance-1',
      sourceFunnelId: 'master-funnel-real-id',
      builderUrl:
        '/admin/tenants/arsenal-team-1/funnels/master-funnel-real-id/builder',
    });
    expect(prisma.funnelArsenalTemplate.update).toHaveBeenCalledWith({
      where: { id: marketplaceTemplate.id },
      data: {
        sourceFunnelInstanceId: 'master-instance-1',
        sourceFunnelId: 'master-funnel-real-id',
      },
    });
  });

  it('rejects marketplace preview with a controlled 422 when no Master Funnel is associated', async () => {
    const commercialProfileService = buildCommercialProfileService(null);
    const prisma = {
      funnelArsenalTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          ...dbHealthTemplate,
          assetSlug: 'health-wellness-evaluation',
          sourceFunnelInstanceId: null,
        }),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(
      service.getSystemPreviewRuntime('health-wellness-evaluation'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'MARKETPLACE_MASTER_REQUIRED',
      }),
    });
    await expect(
      service.getSystemPreviewRuntime('health-wellness-evaluation'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('resolves marketplace preview source from a published Library funnel version', async () => {
    const commercialProfileService = buildCommercialProfileService(null);
    const prisma = {
      funnelArsenalTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          ...dbHealthTemplate,
          assetSlug: 'health-wellness-evaluation',
          sourceFunnelInstanceId: null,
          libraryAssetVersionId: 'library-version-1',
        }),
      },
      libraryAssetVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'library-version-1',
          assetId: 'library-asset-1',
          version: '2.0.0',
          status: 'published',
          publishedAt: new Date('2026-06-26T00:00:00.000Z'),
          asset: {
            id: 'library-asset-1',
            slug: 'health-wellness-evaluation',
            title: 'Evaluación de bienestar',
          },
          funnelVersion: {
            sourceFunnelInstanceId: 'library-master-instance-1',
            sourceFunnelId: 'library-master-funnel-1',
            stepsCount: 1,
            framework: 'diagnostic',
            difficulty: 'basic',
            estimatedMinutes: 7,
            flowSummary: [],
          },
          media: [],
          compatibility: [],
        }),
      },
      funnelInstance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'library-master-instance-1',
          name: 'Library Master',
          code: 'library-master',
          status: 'active',
          structuralType: 'generic',
          conversionContract: {},
          settingsJson: {},
          mediaMap: {},
          team: {
            id: 'arsenal-team-1',
            name: 'LeadFlow Arsenal',
            description: null,
          },
          template: {
            id: 'template-1',
            code: 'library-template',
            name: 'Library Template',
            version: 1,
            funnelType: 'library_funnel',
            blocksJson: [],
            mediaMap: {},
            settingsJson: {},
            allowedOverridesJson: {},
          },
          steps: [
            {
              id: 'step-1',
              slug: 'captura',
              stepType: 'landing',
              position: 0,
              isEntryStep: true,
              isConversionStep: false,
              blocksJson: [],
              mediaMap: {},
              settingsJson: {},
            },
          ],
        }),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(
      service.getSystemPreviewRuntime('health-wellness-evaluation'),
    ).resolves.toMatchObject({
      funnel: {
        id: 'library-master-instance-1',
      },
      currentStep: {
        id: 'step-1',
      },
    });
    expect(prisma.funnelInstance.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'library-master-instance-1',
        },
      }),
    );
  });

  it('rejects marketplace preview when the associated Library version is not published', async () => {
    const commercialProfileService = buildCommercialProfileService(null);
    const prisma = {
      funnelArsenalTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          ...dbHealthTemplate,
          assetSlug: 'health-wellness-evaluation',
          sourceFunnelInstanceId: 'legacy-master-instance-1',
          libraryAssetVersionId: 'library-version-1',
        }),
      },
      libraryAssetVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'library-version-1',
          status: 'draft',
          asset: {
            id: 'library-asset-1',
            slug: 'health-wellness-evaluation',
            title: 'Evaluación de bienestar',
          },
          funnelVersion: null,
          media: [],
          compatibility: [],
        }),
      },
    };
    const service = buildService(prisma, commercialProfileService);

    await expect(
      service.getSystemPreviewRuntime('health-wellness-evaluation'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'LIBRARY_ASSET_VERSION_NOT_PUBLISHED',
      }),
    });
    await expect(
      service.getSystemPreviewRuntime('health-wellness-evaluation'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
