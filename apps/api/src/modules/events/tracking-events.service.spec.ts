import type { PrismaService } from '../../prisma/prisma.service';
import { TrackingEventsService } from './tracking-events.service';

describe('TrackingEventsService public runtime events', () => {
  it('records public browser ids but never stores server-side tokens in the event payload', async () => {
    const createdEvents: any[] = [];
    const publication = {
      id: 'publication-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      funnelInstanceId: 'funnel-1',
      trackingProfileId: null,
      handoffStrategyId: null,
      metaPixelId: 'meta-pixel-1',
      tiktokPixelId: 'tt-pixel-1',
      metaCapiToken: 'meta-token-1',
      tiktokAccessToken: 'tt-token-1',
      pathPrefix: '/promo',
      status: 'active',
      isActive: true,
      domain: {
        host: 'promo.example.com',
        status: 'active',
      },
      funnelInstance: {
        id: 'funnel-1',
        code: 'demo-funnel',
        name: 'Demo Funnel',
        status: 'active',
        trackingProfileId: null,
        handoffStrategyId: null,
        steps: [
          {
            id: 'step-1',
            slug: 'captura',
            stepType: 'landing',
            position: 1,
          },
        ],
      },
    };
    const tx = {
      funnelPublication: {
        findUnique: jest.fn().mockResolvedValue(publication),
      },
      assignment: {
        findUnique: jest.fn(),
      },
      domainEvent: {
        create: jest.fn().mockImplementation(({ data }) => {
          createdEvents.push(data);
          return Promise.resolve({
            id: 'domain-event-1',
            eventId: data.eventId,
            eventName: data.eventName,
            occurredAt: data.occurredAt,
          });
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService;
    const service = new TrackingEventsService(prisma);

    await service.trackPublicRuntimeEvent({
      publicationId: publication.id,
      stepId: 'step-1',
      eventId: 'event-1',
      eventName: 'form_submitted',
      anonymousId: 'anon-1',
      currentPath: '/promo',
    });

    expect(createdEvents).toHaveLength(1);
    expect(createdEvents[0].payload.publication).toEqual({
      id: 'publication-1',
      pathPrefix: '/promo',
      metaPixelId: 'meta-pixel-1',
      tiktokPixelId: 'tt-pixel-1',
    });
    expect(JSON.stringify(createdEvents[0].payload)).not.toContain(
      'meta-token-1',
    );
    expect(JSON.stringify(createdEvents[0].payload)).not.toContain(
      'tt-token-1',
    );
    expect(JSON.stringify(createdEvents[0].payload)).not.toContain(
      'metaCapiToken',
    );
    expect(JSON.stringify(createdEvents[0].payload)).not.toContain(
      'tiktokAccessToken',
    );
  });
});
