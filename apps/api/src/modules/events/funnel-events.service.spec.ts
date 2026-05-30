import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  FunnelEventsService,
  type FunnelEventRecord,
  type RecordFunnelEventInput,
} from './funnel-events.service';

type FunnelEventCreateArgs = {
  data: Record<string, unknown>;
};

const now = new Date('2026-05-30T12:00:00.000Z');

const baseInput = (
  overrides: Partial<RecordFunnelEventInput> = {},
): RecordFunnelEventInput => ({
  eventName: 'funnel_step_viewed',
  eventFamily: 'runtime',
  source: 'public_runtime',
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  trafficLayer: 'PAID_ADS',
  payloadJson: {
    path: '/presentacion',
  },
  ...overrides,
});

const buildRecord = (
  overrides: Partial<FunnelEventRecord> = {},
): FunnelEventRecord => ({
  id: 'funnel-event-1',
  eventId: 'evt_existing',
  eventName: 'funnel_step_viewed',
  eventVersion: '1.0',
  eventFamily: 'runtime',
  source: 'public_runtime',
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  domainId: null,
  funnelPublicationId: null,
  funnelInstanceId: null,
  funnelStepId: null,
  leadId: null,
  visitorId: null,
  assignmentId: null,
  trackedLinkId: null,
  actionLinkKey: null,
  trafficLayer: 'PAID_ADS',
  attributionJson: null,
  payloadJson: {},
  occurredAt: now,
  receivedAt: now,
  correlationId: null,
  dedupeKey: null,
  createdAt: now,
  ...overrides,
});

const buildService = () => {
  const prisma = {
    funnelEvent: {
      findUnique: jest.fn<Promise<FunnelEventRecord | null>, [unknown]>(),
      create: jest.fn<Promise<FunnelEventRecord>, [FunnelEventCreateArgs]>(
        async ({ data }) =>
          buildRecord({
            ...(data as Partial<FunnelEventRecord>),
            id: 'funnel-event-created',
            attributionJson:
              (data.attributionJson as FunnelEventRecord['attributionJson']) ??
              null,
            createdAt: now,
          }),
      ),
    },
  };

  return {
    prisma,
    service: new FunnelEventsService(prisma as unknown as PrismaService),
  };
};

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('FunnelEventsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates an event with a generated evt_ eventId', async () => {
    const { service, prisma } = buildService();

    const result = await service.recordEvent(baseInput());

    expect(result.deduped).toBe(false);
    expect(result.event.eventId).toMatch(/^evt_/);
    expect(prisma.funnelEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: expect.stringMatching(/^evt_/),
      }),
    });
  });

  it('respects a received eventId', async () => {
    const { service, prisma } = buildService();

    const result = await service.recordEvent(
      baseInput({
        eventId: 'evt_custom',
      }),
    );

    expect(result.event.eventId).toBe('evt_custom');
    expect(prisma.funnelEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'evt_custom',
      }),
    });
  });

  it('defaults eventVersion to 1.0', async () => {
    const { service } = buildService();

    const result = await service.recordEvent(baseInput());

    expect(result.event.eventVersion).toBe('1.0');
  });

  it('defaults occurredAt, receivedAt, and payloadJson', async () => {
    const { service, prisma } = buildService();

    const result = await service.recordEvent(
      baseInput({
        payloadJson: undefined,
      }),
    );

    expect(result.event.occurredAt).toEqual(now);
    expect(result.event.receivedAt).toEqual(now);
    expect(result.event.payloadJson).toEqual({});
    expect(prisma.funnelEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        occurredAt: now,
        receivedAt: now,
        payloadJson: {},
      }),
    });
  });

  it('returns an existing event for an existing dedupeKey without creating', async () => {
    const existing = buildRecord({
      id: 'existing-event',
      dedupeKey: 'dedupe-1',
    });
    const { service, prisma } = buildService();
    prisma.funnelEvent.findUnique.mockResolvedValueOnce(existing);

    const result = await service.recordEvent(
      baseInput({
        dedupeKey: 'dedupe-1',
      }),
    );

    expect(result.event).toBe(existing);
    expect(result.deduped).toBe(true);
    expect(prisma.funnelEvent.create).not.toHaveBeenCalled();
  });

  it('refetches and returns existing when create races on dedupeKey P2002', async () => {
    const existing = buildRecord({
      id: 'existing-event',
      dedupeKey: 'dedupe-1',
    });
    const { service, prisma } = buildService();
    prisma.funnelEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    prisma.funnelEvent.create.mockRejectedValueOnce(p2002());

    const result = await service.recordEvent(
      baseInput({
        dedupeKey: 'dedupe-1',
      }),
    );

    expect(result.event).toBe(existing);
    expect(result.deduped).toBe(true);
    expect(prisma.funnelEvent.findUnique).toHaveBeenLastCalledWith({
      where: {
        dedupeKey: 'dedupe-1',
      },
    });
  });

  it('refetches and returns existing when create races on eventId P2002', async () => {
    const existing = buildRecord({
      id: 'existing-event',
      eventId: 'evt_custom',
    });
    const { service, prisma } = buildService();
    prisma.funnelEvent.findUnique.mockResolvedValueOnce(existing);
    prisma.funnelEvent.create.mockRejectedValueOnce(p2002());

    const result = await service.recordEvent(
      baseInput({
        eventId: 'evt_custom',
      }),
    );

    expect(result.event).toBe(existing);
    expect(result.deduped).toBe(false);
    expect(prisma.funnelEvent.findUnique).toHaveBeenCalledWith({
      where: {
        eventId: 'evt_custom',
      },
    });
  });

  it('validates required fields', async () => {
    const cases: Array<keyof RecordFunnelEventInput> = [
      'eventName',
      'eventFamily',
      'source',
      'workspaceId',
      'teamId',
      'trafficLayer',
    ];

    for (const field of cases) {
      const { service, prisma } = buildService();
      await expect(
        service.recordEvent(
          baseInput({
            [field]: ' ',
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.funnelEvent.create).not.toHaveBeenCalled();
    }
  });

  it('allows ORGANIC and DIRECT traffic layers', async () => {
    const { service, prisma } = buildService();

    await service.recordEvent(baseInput({ trafficLayer: 'ORGANIC' }));
    await service.recordEvent(baseInput({ trafficLayer: 'DIRECT' }));

    expect(prisma.funnelEvent.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        trafficLayer: 'ORGANIC',
      }),
    });
    expect(prisma.funnelEvent.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        trafficLayer: 'DIRECT',
      }),
    });
  });

  it('persists attributionJson separately from payloadJson', async () => {
    const { service, prisma } = buildService();

    await service.recordEvent(
      baseInput({
        attributionJson: {
          utm_source: 'newsletter',
        },
        payloadJson: {
          blockId: 'hero',
        },
      }),
    );

    expect(prisma.funnelEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attributionJson: {
          utm_source: 'newsletter',
        },
        payloadJson: {
          blockId: 'hero',
        },
      }),
    });
  });

  it('supports trackedLinkId and actionLinkKey', async () => {
    const { service, prisma } = buildService();

    const result = await service.recordEvent(
      baseInput({
        trackedLinkId: 'tracked-link-1',
        actionLinkKey: 'action-link-1',
      }),
    );

    expect(result.event.trackedLinkId).toBe('tracked-link-1');
    expect(result.event.actionLinkKey).toBe('action-link-1');
    expect(prisma.funnelEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trackedLinkId: 'tracked-link-1',
        actionLinkKey: 'action-link-1',
      }),
    });
  });

  it('rejects non-serializable JSON objects', async () => {
    const { service } = buildService();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(
      service.recordEvent(
        baseInput({
          payloadJson: circular,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.recordEvent(
        baseInput({
          attributionJson: {
            score: Number.POSITIVE_INFINITY,
          },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
