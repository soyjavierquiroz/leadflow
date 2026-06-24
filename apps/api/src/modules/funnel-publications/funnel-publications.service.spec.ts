import type { PrismaService } from '../../prisma/prisma.service';
import { FunnelPublicationsService } from './funnel-publications.service';

describe('FunnelPublicationsService tracking persistence', () => {
  const buildService = () => {
    const existingPublication = {
      id: 'publication-a',
      workspaceId: 'workspace-1',
      teamId: 'team-a',
      domainId: 'domain-a',
      funnelInstanceId: 'funnel-a',
      trackingProfileId: 'tracking-a',
      handoffStrategyId: null,
      metaPixelId: 'meta-pixel-a',
      tiktokPixelId: 'tiktok-pixel-a',
      metaCapiToken: 'meta-token-a',
      tiktokAccessToken: 'tiktok-token-a',
      ogImageUrl: 'https://cdn.example.com/original.webp',
      pathPrefix: '/a',
      status: 'active',
      isActive: true,
      isPrimary: false,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    const prisma = {
      funnelPublication: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existingPublication)
          .mockResolvedValueOnce(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...existingPublication,
            ...data,
            updatedAt: new Date('2026-06-01T00:01:00.000Z'),
          }),
        ),
      },
      domain: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'domain-a',
          workspaceId: 'workspace-1',
          teamId: 'team-a',
          status: 'active',
        }),
      },
      funnelInstance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'funnel-a',
          workspaceId: 'workspace-1',
          teamId: 'team-a',
          status: 'active',
        }),
      },
      trackingProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tracking-a' }),
      },
      handoffStrategy: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    } as unknown as PrismaService;

    return {
      existingPublication,
      prisma,
      service: new FunnelPublicationsService(prisma),
    };
  };

  it('updates tracking on the scoped publication without touching other publications', async () => {
    const { prisma, service } = buildService();

    const result = await service.updateForTeam(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-a',
      },
      'publication-a',
      {
        metaPixelId: 'meta-pixel-a-next',
        tiktokPixelId: 'tiktok-pixel-a-next',
        metaCapiToken: 'meta-token-a-next',
        tiktokAccessToken: 'tiktok-token-a-next',
        ogImageUrl: 'https://cdn.example.com/next.webp',
      },
    );

    expect(prisma.funnelPublication.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'publication-a',
        workspaceId: 'workspace-1',
        teamId: 'team-a',
      },
    });
    expect(prisma.funnelPublication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'publication-a' },
        data: expect.objectContaining({
          metaPixelId: 'meta-pixel-a-next',
          tiktokPixelId: 'tiktok-pixel-a-next',
          metaCapiToken: 'meta-token-a-next',
          tiktokAccessToken: 'tiktok-token-a-next',
          ogImageUrl: 'https://cdn.example.com/next.webp',
        }),
      }),
    );
    expect(result.metaPixelId).toBe('meta-pixel-a-next');
    expect(result.metaCapiToken).toBe('meta-token-a-next');
    expect(result.ogImageUrl).toBe('https://cdn.example.com/next.webp');
  });

  it('preserves existing publication tracking when update payload omits tracking fields', async () => {
    const { existingPublication, prisma, service } = buildService();

    await service.updateForTeam(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-a',
      },
      'publication-a',
      {
        pathPrefix: '/a',
      },
    );

    expect(prisma.funnelPublication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaPixelId: existingPublication.metaPixelId,
          tiktokPixelId: existingPublication.tiktokPixelId,
          metaCapiToken: existingPublication.metaCapiToken,
          tiktokAccessToken: existingPublication.tiktokAccessToken,
          ogImageUrl: existingPublication.ogImageUrl,
        }),
      }),
    );
  });
});
