import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { PublicFunnelRuntimeService } from './public-funnel-runtime.service';

type MockPublicationRecord = {
  id: string;
  workspaceId: string;
  teamId: string;
  domainId: string;
  funnelInstanceId: string;
  trackingProfileId: string | null;
  handoffStrategyId: string | null;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  pathPrefix: string;
  status: 'active';
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
  domain: {
    id: string;
    workspaceId: string;
    teamId: string;
    host: string;
    normalizedHost: string;
    status: 'active';
    domainType: string;
    isPrimary: boolean;
    canonicalHost: string;
    redirectToPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  trackingProfile: null;
  handoffStrategy: null;
  funnelInstance: {
    id: string;
    workspaceId: string;
    teamId: string;
    templateId: string;
    legacyFunnelId: string | null;
    name: string;
    code: string;
    status: 'active';
    rotationPoolId: string | null;
    trackingProfileId: string | null;
    handoffStrategyId: string | null;
    settingsJson: Record<string, unknown>;
    mediaMap: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    trackingProfile: null;
    handoffStrategy: null;
    template: {
      id: string;
      code: string;
      name: string;
      version: number;
      funnelType: string;
      blocksJson: Record<string, unknown>;
      mediaMap: Record<string, unknown>;
      settingsJson: Record<string, unknown>;
      allowedOverridesJson: Record<string, unknown>;
    };
    steps: Array<{
      id: string;
      workspaceId: string;
      teamId: string;
      funnelInstanceId: string;
      stepType: string;
      slug: string;
      position: number;
      isEntryStep: boolean;
      isConversionStep: boolean;
      blocksJson: Record<string, unknown>;
      mediaMap: Record<string, unknown>;
      settingsJson: Record<string, unknown>;
      createdAt: Date;
      updatedAt: Date;
    }>;
  };
};

type FindManyArgs = {
  where: {
    status: string;
    domain: {
      normalizedHost: string;
      status: string;
    };
  };
};

const buildStepRecord = (input: {
  publicationId: string;
  idSuffix: string;
  slug: string;
  position: number;
  isEntryStep?: boolean;
  stepType?: string;
  isConversionStep?: boolean;
  blocksJson?: Record<string, unknown>;
}) => ({
  id: `${input.publicationId}-step-${input.idSuffix}`,
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  funnelInstanceId: 'funnel-1',
  stepType: input.stepType ?? 'landing',
  slug: input.slug,
  position: input.position,
  isEntryStep: input.isEntryStep ?? false,
  isConversionStep: input.isConversionStep ?? false,
  blocksJson: input.blocksJson ?? {},
  mediaMap: {},
  settingsJson: {},
  createdAt: new Date('2026-03-26T00:00:00.000Z'),
  updatedAt: new Date('2026-03-26T00:00:00.000Z'),
});

const buildPublicationRecord = (input: {
  id: string;
  pathPrefix: string;
  host?: string;
  normalizedHost?: string;
  domainType?: string;
  steps?: MockPublicationRecord['funnelInstance']['steps'];
}): MockPublicationRecord => ({
  id: input.id,
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  domainId: 'domain-1',
  funnelInstanceId: 'funnel-1',
  trackingProfileId: null,
  handoffStrategyId: null,
  metaPixelId: 'meta-publication-123',
  tiktokPixelId: 'tiktok-publication-456',
  pathPrefix: input.pathPrefix,
  status: 'active',
  isPrimary: input.pathPrefix === '/',
  createdAt: new Date('2026-03-26T00:00:00.000Z'),
  updatedAt: new Date('2026-03-26T00:00:00.000Z'),
  domain: {
    id: 'domain-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    host: input.host ?? 'localhost',
    normalizedHost: input.normalizedHost ?? 'localhost',
    status: 'active',
    domainType: input.domainType ?? 'system_subdomain',
    isPrimary: true,
    canonicalHost: input.host ?? 'localhost',
    redirectToPrimary: false,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
  },
  trackingProfile: null,
  handoffStrategy: null,
  funnelInstance: {
    id: 'funnel-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    templateId: 'template-1',
    legacyFunnelId: null,
    name: 'Core Acquisition',
    code: 'core-acquisition',
    status: 'active',
    rotationPoolId: null,
    trackingProfileId: null,
    handoffStrategyId: null,
    settingsJson: {},
    mediaMap: {},
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    trackingProfile: null,
    handoffStrategy: null,
    template: {
      id: 'template-1',
      code: 'template-core',
      name: 'Template Core',
      version: 1,
      funnelType: 'lead_capture',
      blocksJson: {},
      mediaMap: {},
      settingsJson: {},
      allowedOverridesJson: {},
    },
    steps:
      input.steps ?? [
        buildStepRecord({
          publicationId: input.id,
          idSuffix: 'entry',
          slug: 'landing',
          position: 1,
          isEntryStep: true,
        }),
      ],
  },
});

describe('PublicFunnelRuntimeService', () => {
  it('queries by normalized host and resolves the longest matching path prefix', async () => {
    const findMany = jest.fn<
      Promise<MockPublicationRecord[]>,
      [FindManyArgs]
    >();
    const prisma = {
      funnelPublication: {
        findMany,
      },
      sponsor: {
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;

    findMany.mockResolvedValue([
      buildPublicationRecord({
        id: 'publication-root',
        pathPrefix: '/',
      }),
      buildPublicationRecord({
        id: 'publication-opportunity',
        pathPrefix: '/oportunidad',
      }),
    ]);

    const service = new PublicFunnelRuntimeService(prisma);
    const runtime = await service.resolveByHostAndPath(
      'LOCALHOST:3000',
      '/oportunidad?utm_source=test',
    );

    const query = findMany.mock.calls[0]?.[0];

    expect(query?.where.status).toBe('active');
    expect(query?.where.domain.normalizedHost).toBe('localhost');
    expect(query?.where.domain.status).toBe('active');
    expect(runtime.publication.id).toBe('publication-opportunity');
    expect(runtime.publication.pathPrefix).toBe('/oportunidad');
    expect(runtime.publication.metaPixelId).toBe('meta-publication-123');
    expect(runtime.publication.tiktokPixelId).toBe('tiktok-publication-456');
    expect(runtime.request.path).toBe('/oportunidad');
    expect(runtime.domain.normalizedHost).toBe('localhost');
    expect(runtime.entryContext).toEqual({
      entryMode: 'paid_ads',
      trafficLayer: 'ORGANIC',
      forcedSponsorId: null,
      adWheelId: null,
      browserPixelsEnabled: true,
    });
  });

  it('marks the entry context as paid wheel when awid belongs to an active wheel window', async () => {
    const findMany = jest.fn<
      Promise<MockPublicationRecord[]>,
      [FindManyArgs]
    >();
    const adWheelFindFirst = jest.fn().mockResolvedValue({
      id: 'wheel-1',
      publicationId: 'publication-root',
      status: 'ACTIVE',
      startDate: new Date('2020-01-01T00:00:00.000Z'),
      endDate: new Date('2099-01-01T00:00:00.000Z'),
    });
    const prisma = {
      funnelPublication: {
        findMany,
      },
      sponsor: {
        findFirst: jest.fn(),
      },
      adWheel: {
        findFirst: adWheelFindFirst,
      },
    } as unknown as PrismaService;

    findMany.mockResolvedValue([
      buildPublicationRecord({
        id: 'publication-root',
        pathPrefix: '/',
      }),
    ]);

    const service = new PublicFunnelRuntimeService(prisma);
    const runtime = await service.resolveByHostAndPath(
      'localhost',
      '/?awid=wheel-1',
    );

    expect(adWheelFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'wheel-1',
        teamId: 'team-1',
      },
      select: {
        id: true,
        publicationId: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });
    expect(runtime.entryContext).toEqual({
      entryMode: 'paid_ads',
      trafficLayer: 'PAID_WHEEL',
      forcedSponsorId: null,
      adWheelId: 'wheel-1',
      browserPixelsEnabled: true,
    });
  });

  it('falls back to direct organic entry context when awid lookup fails', async () => {
    const findMany = jest.fn<
      Promise<MockPublicationRecord[]>,
      [FindManyArgs]
    >();
    const adWheelFindFirst = jest
      .fn()
      .mockRejectedValue(new Error('column AdWheel.publicationId does not exist'));
    const prisma = {
      funnelPublication: {
        findMany,
      },
      sponsor: {
        findFirst: jest.fn(),
      },
      adWheel: {
        findFirst: adWheelFindFirst,
      },
    } as unknown as PrismaService;

    findMany.mockResolvedValue([
      buildPublicationRecord({
        id: 'publication-root',
        pathPrefix: '/',
      }),
    ]);

    const service = new PublicFunnelRuntimeService(prisma);
    const runtime = await service.resolveByHostAndPath(
      'localhost',
      '/?awid=wheel-1',
    );

    expect(adWheelFindFirst).toHaveBeenCalled();
    expect(runtime.entryContext).toEqual({
      entryMode: 'paid_ads',
      trafficLayer: 'DIRECT',
      forcedSponsorId: null,
      adWheelId: null,
      browserPixelsEnabled: true,
    });
  });

  it('rejects resolution attempts without a valid host', async () => {
    const findMany = jest.fn<
      Promise<MockPublicationRecord[]>,
      [FindManyArgs]
    >();
    const prisma = {
      funnelPublication: {
        findMany,
      },
      sponsor: {
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;

    const service = new PublicFunnelRuntimeService(prisma);

    await expect(
      service.resolveByHostAndPath('   ', '/'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('normalizes step slugs and resolves secondary steps strictly by URL slug', async () => {
    const findMany = jest.fn<
      Promise<MockPublicationRecord[]>,
      [FindManyArgs]
    >();
    const prisma = {
      funnelPublication: {
        findMany,
      },
      sponsor: {
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;

    findMany.mockResolvedValue([
      buildPublicationRecord({
        id: 'publication-root',
        pathPrefix: '/',
        steps: [
          buildStepRecord({
            publicationId: 'publication-root',
            idSuffix: 'entry',
            slug: 'landing',
            position: 1,
            isEntryStep: true,
            blocksJson: { step: 'landing' },
          }),
          buildStepRecord({
            publicationId: 'publication-root',
            idSuffix: 'confirmado',
            slug: '/confirmado/',
            position: 2,
            stepType: 'thank_you',
            blocksJson: { step: 'confirmado' },
          }),
        ],
      }),
    ]);

    const service = new PublicFunnelRuntimeService(prisma);
    const runtime = await service.resolveByHostAndPath(
      'LOCALHOST:3000',
      '/confirmado/',
    );

    expect(runtime.request.path).toBe('/confirmado');
    expect(runtime.currentStep.slug).toBe('confirmado');
    expect(runtime.currentStep.path).toBe('/confirmado');
    expect(runtime.currentStep.blocksJson).toEqual({ step: 'confirmado' });
    expect(runtime.steps.map((step) => step.slug)).toEqual([
      'landing',
      'confirmado',
    ]);
  });

  it('throws 404 when a non-root slug does not match any published step', async () => {
    const findMany = jest.fn<
      Promise<MockPublicationRecord[]>,
      [FindManyArgs]
    >();
    const prisma = {
      funnelPublication: {
        findMany,
      },
      sponsor: {
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;

    findMany.mockResolvedValue([
      buildPublicationRecord({
        id: 'publication-root',
        pathPrefix: '/',
        steps: [
          buildStepRecord({
            publicationId: 'publication-root',
            idSuffix: 'entry',
            slug: 'landing',
            position: 1,
            isEntryStep: true,
          }),
          buildStepRecord({
            publicationId: 'publication-root',
            idSuffix: 'confirmado',
            slug: 'confirmado',
            position: 2,
            stepType: 'thank_you',
          }),
        ],
      }),
    ]);

    const service = new PublicFunnelRuntimeService(prisma);

    await expect(
      service.resolveByHostAndPath('localhost', '/desconocido'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves personal advisor links against the root publication and disables browser pixels', async () => {
    const findMany = jest.fn<
      Promise<MockPublicationRecord[]>,
      [FindManyArgs]
    >();
    const sponsorFindFirst = jest.fn().mockResolvedValue({
      id: 'sponsor-1',
    });
    const prisma = {
      funnelPublication: {
        findMany,
      },
      sponsor: {
        findFirst: sponsorFindFirst,
      },
    } as unknown as PrismaService;

    findMany.mockResolvedValue([
      buildPublicationRecord({
        id: 'publication-root',
        pathPrefix: '/',
        steps: [
          buildStepRecord({
            publicationId: 'publication-root',
            idSuffix: 'entry',
            slug: 'landing',
            position: 1,
            isEntryStep: true,
          }),
          buildStepRecord({
            publicationId: 'publication-root',
            idSuffix: 'confirmado',
            slug: 'confirmado',
            position: 2,
            stepType: 'thank_you',
          }),
        ],
      }),
      buildPublicationRecord({
        id: 'publication-opportunity',
        pathPrefix: '/oportunidad',
      }),
    ]);

    const service = new PublicFunnelRuntimeService(prisma);
    const runtime = await service.resolveByHostAndPath(
      'localhost',
      '/a/asesor-uno/confirmado',
    );

    expect(sponsorFindFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        publicSlug: 'asesor-uno',
        isActive: true,
        status: 'active',
        availabilityStatus: 'available',
      },
      select: {
        id: true,
      },
    });
    expect(runtime.publication.id).toBe('publication-root');
    expect(runtime.request.publicationPathPrefix).toBe('/a/asesor-uno');
    expect(runtime.currentStep.path).toBe('/a/asesor-uno/confirmado');
    expect(runtime.entryContext).toEqual({
      entryMode: 'organic_asesor',
      trafficLayer: 'DIRECT',
      forcedSponsorId: 'sponsor-1',
      adWheelId: null,
      browserPixelsEnabled: false,
    });
  });

  it('resolves publication scoped ref paths and keeps the ref prefix for multipage navigation', async () => {
    const findMany = jest.fn<
      Promise<MockPublicationRecord[]>,
      [FindManyArgs]
    >();
    const sponsorFindFirst = jest.fn().mockResolvedValue({
      id: 'sponsor-1',
    });
    const prisma = {
      funnelPublication: {
        findMany,
      },
      sponsor: {
        findFirst: sponsorFindFirst,
      },
    } as unknown as PrismaService;

    findMany.mockResolvedValue([
      buildPublicationRecord({
        id: 'publication-root',
        pathPrefix: '/',
      }),
      buildPublicationRecord({
        id: 'publication-demo',
        pathPrefix: '/demo',
        steps: [
          buildStepRecord({
            publicationId: 'publication-demo',
            idSuffix: 'entry',
            slug: 'landing',
            position: 1,
            isEntryStep: true,
          }),
          buildStepRecord({
            publicationId: 'publication-demo',
            idSuffix: 'gracias',
            slug: 'gracias',
            position: 2,
            stepType: 'thank_you',
          }),
        ],
      }),
    ]);

    const service = new PublicFunnelRuntimeService(prisma);
    const runtime = await service.resolveByHostAndPath(
      'localhost',
      '/demo/ref/asesor-uno/gracias',
    );

    expect(runtime.publication.id).toBe('publication-demo');
    expect(runtime.request.publicationPathPrefix).toBe('/demo/ref/asesor-uno');
    expect(runtime.currentStep.slug).toBe('gracias');
    expect(runtime.currentStep.path).toBe('/demo/ref/asesor-uno/gracias');
    expect(runtime.previousStep?.path).toBe('/demo/ref/asesor-uno');
    expect(runtime.entryContext).toEqual({
      entryMode: 'organic_asesor',
      trafficLayer: 'DIRECT',
      forcedSponsorId: 'sponsor-1',
      adWheelId: null,
      browserPixelsEnabled: false,
    });
  });

  it('resolves query ref attribution and appends the query ref to adjacent steps', async () => {
    const findMany = jest.fn<
      Promise<MockPublicationRecord[]>,
      [FindManyArgs]
    >();
    const sponsorFindFirst = jest.fn().mockResolvedValue({
      id: 'sponsor-1',
    });
    const prisma = {
      funnelPublication: {
        findMany,
      },
      sponsor: {
        findFirst: sponsorFindFirst,
      },
    } as unknown as PrismaService;

    findMany.mockResolvedValue([
      buildPublicationRecord({
        id: 'publication-demo',
        pathPrefix: '/demo',
        steps: [
          buildStepRecord({
            publicationId: 'publication-demo',
            idSuffix: 'entry',
            slug: 'landing',
            position: 1,
            isEntryStep: true,
          }),
          buildStepRecord({
            publicationId: 'publication-demo',
            idSuffix: 'gracias',
            slug: 'gracias',
            position: 2,
            stepType: 'thank_you',
          }),
        ],
      }),
    ]);

    const service = new PublicFunnelRuntimeService(prisma);
    const runtime = await service.resolveByHostAndPath(
      'localhost',
      '/demo?ref=asesor-uno',
    );

    expect(runtime.currentStep.path).toBe('/demo?ref=asesor-uno');
    expect(runtime.nextStep?.path).toBe('/demo/gracias?ref=asesor-uno');
    expect(runtime.entryContext).toEqual({
      entryMode: 'organic_asesor',
      trafficLayer: 'DIRECT',
      forcedSponsorId: 'sponsor-1',
      adWheelId: null,
      browserPixelsEnabled: false,
    });
  });
});
