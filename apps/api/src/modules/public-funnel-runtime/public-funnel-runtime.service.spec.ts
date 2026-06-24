import type { PrismaService } from '../../prisma/prisma.service';
import { PublicFunnelRuntimeService } from './public-funnel-runtime.service';

const buildStepRecord = (publicationId: string) => ({
  id: `${publicationId}-step-entry`,
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  funnelInstanceId: `${publicationId}-funnel`,
  stepType: 'landing',
  slug: 'captura',
  position: 1,
  isEntryStep: true,
  isConversionStep: false,
  blocksJson: {},
  mediaMap: {},
  settingsJson: {},
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
});

const buildPublicationRecord = (input: {
  id: string;
  teamId: string;
  pathPrefix: string;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  metaCapiToken: string | null;
  tiktokAccessToken: string | null;
}) => ({
  id: input.id,
  workspaceId: 'workspace-1',
  teamId: input.teamId,
  domainId: 'domain-1',
  funnelInstanceId: `${input.id}-funnel`,
  trackingProfileId: `${input.id}-tracking`,
  handoffStrategyId: null,
  seoTitle: null,
  seoDescription: null,
  ogImageUrl: null,
  faviconUrl: null,
  manifestVersion: 1,
  runtimeHealthStatus: 'healthy',
  metaPixelId: input.metaPixelId,
  tiktokPixelId: input.tiktokPixelId,
  metaCapiToken: input.metaCapiToken,
  tiktokAccessToken: input.tiktokAccessToken,
  pathPrefix: input.pathPrefix,
  status: 'active',
  isActive: true,
  isPrimary: input.pathPrefix === '/',
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  domain: {
    id: 'domain-1',
    workspaceId: 'workspace-1',
    teamId: input.teamId,
    host: 'tenant.example.com',
    normalizedHost: 'tenant.example.com',
    status: 'active',
    domainType: 'custom',
    isPrimary: true,
    canonicalHost: null,
    redirectToPrimary: false,
  },
  team: {
    id: input.teamId,
    name: `Team ${input.teamId}`,
    description: null,
  },
  trackingProfile: {
    id: `${input.id}-tracking`,
    name: `Tracking ${input.id}`,
    provider: 'meta',
    deduplicationMode: 'event_id',
    configJson: {
      publicDataset: 'browser-ok',
      metaCapiToken: input.metaCapiToken,
      nested: {
        tiktokAccessToken: input.tiktokAccessToken,
        pixelLabel: 'safe',
      },
    },
    conversionEventMappings: [],
  },
  handoffStrategy: null,
  funnelInstance: {
    id: `${input.id}-funnel`,
    workspaceId: 'workspace-1',
    teamId: input.teamId,
    templateId: 'template-1',
    funnelId: null,
    name: `Funnel ${input.id}`,
    code: `funnel-${input.id}`,
    status: 'active',
    structuralType: 'generic',
    conversionContract: {},
    rotationPoolId: null,
    trackingProfileId: null,
    handoffStrategyId: null,
    settingsJson: {},
    mediaMap: {},
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
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
    steps: [buildStepRecord(input.id)],
  },
});

describe('PublicFunnelRuntimeService tracking payload', () => {
  const buildService = (publications: ReturnType<typeof buildPublicationRecord>[]) => {
    const prisma = {
      funnelPublication: {
        findMany: jest.fn().mockResolvedValue(publications),
      },
      adWheel: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      sponsor: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const service = new PublicFunnelRuntimeService(prisma, {
      verifyToken: jest.fn(),
    } as never);

    jest
      .spyOn(service as never, 'resolveRuntimeSponsorContext')
      .mockResolvedValue(null as never);

    return { prisma, service };
  };

  it('returns browser pixel ids without public CAPI or access tokens', async () => {
    const { service } = buildService([
      buildPublicationRecord({
        id: 'publication-a',
        teamId: 'team-a',
        pathPrefix: '/a',
        metaPixelId: 'meta-pixel-a',
        tiktokPixelId: 'tiktok-pixel-a',
        metaCapiToken: 'meta-secret-a',
        tiktokAccessToken: 'tiktok-secret-a',
      }),
    ]);

    const runtime = await service.resolveByHostAndPath(
      'TENANT.EXAMPLE.COM',
      '/a',
    );
    const serializedRuntime = JSON.stringify(runtime);

    expect(runtime.publication.metaPixelId).toBe('meta-pixel-a');
    expect(runtime.publication.tiktokPixelId).toBe('tiktok-pixel-a');
    expect(serializedRuntime).not.toContain('meta-secret-a');
    expect(serializedRuntime).not.toContain('tiktok-secret-a');
    expect(serializedRuntime).not.toContain('metaCapiToken');
    expect(serializedRuntime).not.toContain('tiktokAccessToken');
    expect(runtime.trackingProfile?.configJson).toEqual({
      publicDataset: 'browser-ok',
      nested: {
        pixelLabel: 'safe',
      },
    });
  });

  it('keeps publication tracking isolated across matching host paths', async () => {
    const { service } = buildService([
      buildPublicationRecord({
        id: 'publication-a',
        teamId: 'team-a',
        pathPrefix: '/a',
        metaPixelId: 'meta-pixel-a',
        tiktokPixelId: 'tiktok-pixel-a',
        metaCapiToken: 'meta-secret-a',
        tiktokAccessToken: 'tiktok-secret-a',
      }),
      buildPublicationRecord({
        id: 'publication-b',
        teamId: 'team-b',
        pathPrefix: '/b',
        metaPixelId: 'meta-pixel-b',
        tiktokPixelId: 'tiktok-pixel-b',
        metaCapiToken: 'meta-secret-b',
        tiktokAccessToken: 'tiktok-secret-b',
      }),
    ]);

    const runtimeA = await service.resolveByHostAndPath(
      'tenant.example.com',
      '/a',
    );
    const runtimeB = await service.resolveByHostAndPath(
      'tenant.example.com',
      '/b',
    );

    expect(runtimeA.publication.id).toBe('publication-a');
    expect(runtimeA.team.id).toBe('team-a');
    expect(runtimeA.publication.metaPixelId).toBe('meta-pixel-a');
    expect(runtimeB.publication.id).toBe('publication-b');
    expect(runtimeB.team.id).toBe('team-b');
    expect(runtimeB.publication.metaPixelId).toBe('meta-pixel-b');
  });
});
