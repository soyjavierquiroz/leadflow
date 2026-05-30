import { CrmOutreachStatus, LeadSourceChannel } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { CrmMessageTemplateService } from './crm-message-template.service';
import { CrmOutreachQueueService } from './crm-outreach-queue.service';

const scope = {
  workspaceId: 'workspace-1',
  teamId: 'team-1',
};

const queuedRow = {
  id: 'queue-1',
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  leadId: 'lead-1',
  sponsorId: 'sponsor-1',
  intentType: 'initial_contact',
  status: CrmOutreachStatus.queued,
  scheduledAt: new Date('2026-05-26T12:00:00.000Z'),
  randomizedDelayMs: 120000,
  payloadJson: {
    assignment_id: 'assignment-1',
    dispatch_enabled: true,
  },
  createdAt: new Date('2026-05-26T11:00:00.000Z'),
  updatedAt: new Date('2026-05-26T11:00:00.000Z'),
  lead: {
    id: 'lead-1',
    fullName: 'Ana Rivera',
    phone: '+59170000000',
    sourceChannel: LeadSourceChannel.form,
  },
  sponsor: {
    id: 'sponsor-1',
    displayName: 'Javier',
  },
  workspace: {
    timezone: 'America/La_Paz',
  },
};

const buildService = () => {
  const prisma = {
    crmOutreachQueue: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  } as unknown as PrismaService;

  return {
    prisma,
    service: new CrmOutreachQueueService(
      prisma,
      new CrmMessageTemplateService(),
    ),
  };
};

describe('CrmOutreachQueueService', () => {
  it('lists queue rows with filters, cursor and counts', async () => {
    const { prisma, service } = buildService();
    prisma.crmOutreachQueue.findMany = jest.fn().mockResolvedValue([
      queuedRow,
      {
        ...queuedRow,
        id: 'queue-2',
        createdAt: new Date('2026-05-26T10:00:00.000Z'),
      },
    ]);
    prisma.crmOutreachQueue.count = jest
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await service.listOutreachQueue(scope, {
      status: 'queued',
      sponsor_id: 'sponsor-1',
      q: 'Ana',
      limit: 1,
    });

    expect(prisma.crmOutreachQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          teamId: 'team-1',
          sponsorId: 'sponsor-1',
          status: CrmOutreachStatus.queued,
        }),
        take: 2,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'queue-1',
        assignment_id: 'assignment-1',
        sponsor_name: 'Javier',
        status: 'queued',
        dispatch_enabled: true,
      }),
    );
    expect(result.counts).toEqual({
      queued: 2,
      blocked: 1,
      dispatched: 0,
      cancelled: 0,
    });
    expect(result.page.next_cursor).toEqual(expect.any(String));
  });

  it('dry run renders preview and does not mutate or dispatch', async () => {
    const { prisma, service } = buildService();
    prisma.crmOutreachQueue.findFirst = jest.fn().mockResolvedValue(queuedRow);

    const result = await service.dryRunOutreach(
      scope,
      'queue-1',
      new Date('2026-05-26T14:00:00.000Z'),
    );

    expect(prisma.crmOutreachQueue.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        queue_id: 'queue-1',
        lead_id: 'lead-1',
        sponsor_id: 'sponsor-1',
        allowed_to_dispatch: true,
        blocked_reason: null,
      }),
    );
    expect(result.payload.rendered_preview).toContain('Ana');
    expect(result.payload.rendered_preview).toContain('Javier');
  });

  it('claims a queued dispatchable row only once', async () => {
    const { prisma, service } = buildService();
    prisma.crmOutreachQueue.findFirst = jest.fn().mockResolvedValue(queuedRow);
    prisma.crmOutreachQueue.updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await service.claimNextDispatchableOutreach({
      ...scope,
      now: new Date('2026-05-26T14:00:00.000Z'),
    });
    const second = await service.claimNextDispatchableOutreach({
      ...scope,
      now: new Date('2026-05-26T14:00:00.000Z'),
    });

    expect(first).toEqual(
      expect.objectContaining({
        queue_id: 'queue-1',
        status: CrmOutreachStatus.processing,
      }),
    );
    expect(second).toBeNull();
  });

  it('does not claim rows outside queued status', async () => {
    const { prisma, service } = buildService();
    prisma.crmOutreachQueue.findFirst = jest.fn().mockResolvedValue(null);

    const result = await service.claimNextDispatchableOutreach({
      ...scope,
      now: new Date('2026-05-26T14:00:00.000Z'),
    });

    expect(result).toBeNull();
    expect(prisma.crmOutreachQueue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: CrmOutreachStatus.queued,
        }),
      }),
    );
    expect(prisma.crmOutreachQueue.updateMany).not.toHaveBeenCalled();
  });
});
