import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { FunnelEventsService } from '../events/funnel-events.service';
import { PublicFunnelVslEventsService } from './public-funnel-vsl-events.service';
import type { TrackPublicVslEventDto } from './dto/track-public-vsl-event.dto';

const buildPublication = (
  overrides: Partial<{
    id: string;
    workspaceId: string;
    teamId: string;
    domainId: string;
    funnelInstanceId: string;
    funnelInstance: {
      steps: Array<{
        id: string;
        slug: string;
      }>;
    };
  }> = {},
) => ({
  id: 'publication-1',
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  domainId: 'domain-1',
  funnelInstanceId: 'instance-1',
  funnelInstance: {
    steps: [
      {
        id: 'step-1',
        slug: 'captura',
      },
      {
        id: 'step-2',
        slug: 'presentacion',
      },
    ],
  },
  ...overrides,
});

const baseDto = (
  overrides: Partial<TrackPublicVslEventDto> = {},
): TrackPublicVslEventDto => ({
  eventName: 'vsl_started',
  publicationId: 'publication-1',
  stepId: 'step-2',
  visitorId: 'visitor-1',
  leadId: 'lead-1',
  assignmentId: 'assignment-1',
  anonymousId: 'anonymous-1',
  sessionId: 'session-1',
  trafficLayer: 'ORGANIC',
  currentPath: '/presentacion',
  referrer: 'https://example-referrer.com/',
  blockId: 'hero-vsl-delayed-main',
  blockType: 'hero_vsl_delayed_cta',
  stepKey: 'presentacion',
  stepSlug: 'presentacion',
  videoId: 'media:vsl_main',
  mediaId: 'vsl_main',
  progressPercent: 0,
  currentTimeSeconds: 0,
  durationSeconds: 840,
  ctaMode: 'assigned_whatsapp',
  revealAfterSeconds: 10,
  revealSource: 'time_update',
  metadata: {
    provider: 'bunnynet',
  },
  ...overrides,
});

const buildService = (input?: {
  publication?: ReturnType<typeof buildPublication> | null;
  lead?: { id: string; trafficLayer: string | null } | null;
  assignment?: { id: string; trafficLayer: string | null } | null;
  recordEvent?: jest.Mock;
}) => {
  const prisma = {
    funnelPublication: {
      findUnique: jest
        .fn()
        .mockResolvedValue(input?.publication ?? buildPublication()),
    },
    lead: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          input?.lead === undefined
            ? { id: 'lead-1', trafficLayer: 'PAID_ADS' }
            : input.lead,
        ),
    },
    assignment: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          input?.assignment === undefined
            ? { id: 'assignment-1', trafficLayer: 'DIRECT' }
            : input.assignment,
        ),
    },
    domainEvent: {
      create: jest.fn(),
    },
  };
  const funnelEventsService = {
    recordEvent:
      input?.recordEvent ??
      jest.fn().mockResolvedValue({
        event: {
          eventId: 'evt-recorded',
        },
        deduped: false,
      }),
  };

  return {
    prisma,
    funnelEventsService,
    service: new PublicFunnelVslEventsService(
      prisma as unknown as PrismaService,
      funnelEventsService as unknown as FunnelEventsService,
    ),
  };
};

describe('PublicFunnelVslEventsService', () => {
  it('writes vsl_started FunnelEvent with canonical context', async () => {
    const { service, prisma, funnelEventsService } = buildService();

    const result = await service.trackVslEvent(baseDto());

    expect(result).toEqual({
      ok: true,
      eventName: 'vsl_started',
      deduped: false,
      eventId: 'evt-recorded',
    });
    expect(prisma.funnelPublication.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'publication-1',
      },
      select: expect.objectContaining({
        id: true,
        workspaceId: true,
        teamId: true,
        domainId: true,
        funnelInstanceId: true,
      }),
    });
    expect(funnelEventsService.recordEvent).toHaveBeenCalledWith({
      eventId: expect.stringMatching(/^evt_/),
      eventName: 'vsl_started',
      eventFamily: 'journey',
      source: 'public_vsl_runtime',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      domainId: 'domain-1',
      funnelPublicationId: 'publication-1',
      funnelInstanceId: 'instance-1',
      funnelStepId: 'step-2',
      leadId: 'lead-1',
      visitorId: 'visitor-1',
      assignmentId: 'assignment-1',
      trafficLayer: 'PAID_ADS',
      dedupeKey:
        'vsl_started:lead:lead-1:publication-1:step-2:hero-vsl-delayed-main:session-1',
      attributionJson: {
        currentPath: '/presentacion',
        referrer: 'https://example-referrer.com/',
      },
      payloadJson: {
        stepKey: 'presentacion',
        stepSlug: 'presentacion',
        blockType: 'hero_vsl_delayed_cta',
        blockId: 'hero-vsl-delayed-main',
        videoId: 'media:vsl_main',
        mediaId: 'vsl_main',
        progressPercent: 0,
        currentTimeSeconds: 0,
        durationSeconds: 840,
        ctaMode: 'assigned_whatsapp',
        revealAfterSeconds: 10,
        revealSource: 'time_update',
        sourcePath: '/presentacion',
        referrer: 'https://example-referrer.com/',
        ctaLabel: null,
        ctaHref: null,
        ctaAction: null,
        sessionId: 'session-1',
        anonymousId: 'anonymous-1',
        metadata: {
          provider: 'bunnynet',
        },
      },
    });
  });

  it('rejects non-whitelisted event', async () => {
    const { service, prisma, funnelEventsService } = buildService();

    await expect(
      service.trackVslEvent(
        baseDto({
          eventName: 'video_started',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.funnelPublication.findUnique).not.toHaveBeenCalled();
    expect(funnelEventsService.recordEvent).not.toHaveBeenCalled();
  });

  it('rejects step not in publication', async () => {
    const { service, funnelEventsService } = buildService();

    await expect(
      service.trackVslEvent(
        baseDto({
          stepId: 'step-missing',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(funnelEventsService.recordEvent).not.toHaveBeenCalled();
  });

  it('uses lead trafficLayer over DTO', async () => {
    const { service, funnelEventsService } = buildService({
      lead: {
        id: 'lead-1',
        trafficLayer: 'PAID_WHEEL',
      },
      assignment: {
        id: 'assignment-1',
        trafficLayer: 'DIRECT',
      },
    });

    await service.trackVslEvent(baseDto({ trafficLayer: 'ORGANIC' }));

    expect(funnelEventsService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        trafficLayer: 'PAID_WHEEL',
      }),
    );
  });

  it('uses assignment trafficLayer if lead is missing', async () => {
    const { service, funnelEventsService } = buildService({
      lead: null,
      assignment: {
        id: 'assignment-1',
        trafficLayer: 'DIRECT',
      },
    });

    await service.trackVslEvent(baseDto({ trafficLayer: 'ORGANIC' }));

    expect(funnelEventsService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        trafficLayer: 'DIRECT',
      }),
    );
  });

  it('falls back to DTO trafficLayer then unknown', async () => {
    const { service, funnelEventsService } = buildService({
      lead: null,
      assignment: null,
    });

    await service.trackVslEvent(baseDto({ trafficLayer: 'ORGANIC' }));
    await service.trackVslEvent(baseDto({ trafficLayer: null }));

    expect(funnelEventsService.recordEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        trafficLayer: 'ORGANIC',
      }),
    );
    expect(funnelEventsService.recordEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        trafficLayer: 'unknown',
      }),
    );
  });

  it('builds dedupeKey for vsl_progress_50', async () => {
    const { service, funnelEventsService } = buildService();

    await service.trackVslEvent(
      baseDto({
        eventName: 'vsl_progress_50',
        progressPercent: 50,
      }),
    );

    expect(funnelEventsService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey:
          'vsl_progress_50:lead:lead-1:publication-1:step-2:hero-vsl-delayed-main:session-1',
      }),
    );
  });

  it('does not set dedupeKey for vsl_cta_clicked', async () => {
    const { service, funnelEventsService } = buildService();

    await service.trackVslEvent(
      baseDto({
        eventName: 'vsl_cta_clicked',
        ctaLabel: 'Aplicar ahora',
        ctaHref: 'https://wa.me/59170554048',
        ctaAction: 'assigned_whatsapp',
      }),
    );

    expect(funnelEventsService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'vsl_cta_clicked',
        dedupeKey: null,
      }),
    );
  });

  it('anonymous and session identity works without lead or visitor', async () => {
    const { service, funnelEventsService } = buildService({
      lead: null,
      assignment: null,
    });

    await service.trackVslEvent(
      baseDto({
        leadId: null,
        visitorId: null,
        assignmentId: null,
        anonymousId: 'anonymous-2',
        sessionId: 'session-2',
      }),
    );

    expect(funnelEventsService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: null,
        visitorId: null,
        assignmentId: null,
        dedupeKey:
          'vsl_started:anon:anonymous-2:publication-1:step-2:hero-vsl-delayed-main:session-2',
      }),
    );
  });

  it('rejects events without usable identity', async () => {
    const { service, funnelEventsService } = buildService();

    await expect(
      service.trackVslEvent(
        baseDto({
          leadId: null,
          visitorId: null,
          anonymousId: null,
          sessionId: null,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(funnelEventsService.recordEvent).not.toHaveBeenCalled();
  });

  it('returns deduped true from FunnelEventsService', async () => {
    const recordEvent = jest.fn().mockResolvedValue({
      event: {
        eventId: 'evt-existing',
      },
      deduped: true,
    });
    const { service } = buildService({ recordEvent });

    const result = await service.trackVslEvent(baseDto());

    expect(result).toEqual({
      ok: true,
      eventName: 'vsl_started',
      deduped: true,
      eventId: 'evt-existing',
    });
  });

  it('returns ok false when FunnelEventsService fails without writing DomainEvent', async () => {
    const recordEvent = jest.fn().mockRejectedValue(new Error('ledger down'));
    const { service, prisma } = buildService({ recordEvent });

    const result = await service.trackVslEvent(
      baseDto({
        eventId: 'evt-input',
      }),
    );

    expect(result).toEqual({
      ok: false,
      eventName: 'vsl_started',
      deduped: false,
      eventId: 'evt-input',
    });
    expect(prisma.domainEvent.create).not.toHaveBeenCalled();
  });
});
