import type { PrismaService } from '../../prisma/prisma.service';
import { HybridFunnelPublicationsService } from './hybrid-funnel-publications.service';

const baseDate = new Date('2026-06-24T00:00:00.000Z');

describe('HybridFunnelPublicationsService publication SEO image', () => {
  const buildService = () => {
    const entryStep = {
      id: 'step-entry',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      funnelInstanceId: 'funnel-instance-1',
      stepType: 'landing',
      slug: 'captura',
      position: 1,
      isEntryStep: true,
      isConversionStep: false,
      blocksJson: [{ type: 'hero' }],
      mediaMap: {},
      settingsJson: {
        seo: {
          title: 'Original title',
          metaDescription: 'Original description',
        },
      },
      createdAt: baseDate,
      updatedAt: baseDate,
    };
    const existingPublication = {
      id: 'publication-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      domainId: 'domain-1',
      funnelInstanceId: 'funnel-instance-1',
      trackingProfileId: null,
      handoffStrategyId: null,
      seoTitle: 'Original title',
      seoDescription: 'Original description',
      ogImageUrl: 'https://cdn.example.com/original.webp',
      faviconUrl: null,
      manifestVersion: 1,
      runtimeHealthStatus: 'healthy',
      metaPixelId: 'meta-pixel-1',
      tiktokPixelId: null,
      metaCapiToken: null,
      tiktokAccessToken: null,
      pathPrefix: '/presentacion',
      status: 'active',
      isActive: true,
      isPrimary: true,
      createdAt: baseDate,
      updatedAt: baseDate,
      funnelInstance: {
        id: 'funnel-instance-1',
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        templateId: 'template-1',
        funnelId: 'legacy-funnel-1',
        name: 'Reto funnel',
        code: 'reto-funnel',
        status: 'active',
        structuralType: 'lead_capture',
        conversionContract: {},
        rotationPoolId: null,
        trackingProfileId: null,
        handoffStrategyId: null,
        settingsJson: {},
        mediaMap: {},
        createdAt: baseDate,
        updatedAt: baseDate,
        funnel: {
          config: {},
        },
        steps: [entryStep],
      },
    };
    const tx = {
      funnel: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      funnelInstance: {
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...existingPublication.funnelInstance,
            ...data,
          }),
        ),
      },
      funnelStep: {
        create: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...entryStep,
            ...data,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([entryStep]),
      },
      funnelPublication: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...existingPublication,
            ...data,
          }),
        ),
      },
      funnelStepHistory: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      funnelPublication: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existingPublication)
          .mockResolvedValueOnce(null),
      },
      domain: {
        findFirst: jest.fn().mockResolvedValue({ id: 'domain-1' }),
      },
      funnelTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'template-1',
          code: 'template-core',
          settingsJson: {},
          defaultHandoffStrategyId: null,
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService;
    const runtimeContextConfigSyncService = {
      syncFunnelContextForInstance: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new HybridFunnelPublicationsService(
        prisma,
        runtimeContextConfigSyncService as never,
      ),
      tx,
      runtimeContextConfigSyncService,
    };
  };

  it('persists and returns ogImageUrl from the builder update payload', async () => {
    const { service, tx } = buildService();

    const result = await service.updateForTeam(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
      'publication-1',
      {
        name: 'Reto funnel',
        domainId: 'domain-1',
        pathPrefix: '/presentacion',
        templateId: 'template-1',
        seoTitle: 'Reto SEO',
        metaDescription: 'Descripcion SEO',
        ogImageUrl: 'https://cdn.example.com/reto-og.webp',
        blocksJson: [{ type: 'hero' }],
        mediaMap: {},
        settingsJson: {},
      },
    );

    expect(tx.funnelPublication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'publication-1' },
        data: expect.objectContaining({
          ogImageUrl: 'https://cdn.example.com/reto-og.webp',
        }),
      }),
    );
    expect(result.publication.ogImageUrl).toBe(
      'https://cdn.example.com/reto-og.webp',
    );
    expect(result.seo.ogImageUrl).toBe('https://cdn.example.com/reto-og.webp');
  });
});
