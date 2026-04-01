import { BadRequestException } from '@nestjs/common';
import { LeadsService } from './leads.service';

describe('LeadsService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a draft lead aggregate', () => {
    const service = new LeadsService({} as never);

    const result = service.createDraft({
      workspaceId: 'workspace-1',
      funnelId: 'funnel-1',
      sourceChannel: 'form',
      fullName: 'Jane Prospect',
      email: 'jane@example.com',
      tags: ['inbound'],
    });

    expect(result.workspaceId).toBe('workspace-1');
    expect(result.funnelId).toBe('funnel-1');
    expect(result.status).toBe('captured');
    expect(result.currentAssignmentId).toBeNull();
    expect(result.tags).toEqual(['inbound']);
    expect(typeof result.id).toBe('string');
  });

  it('rejects invalid member lead statuses before touching persistence', async () => {
    const prisma = {
      lead: {
        findFirst: jest.fn(),
      },
    };
    const service = new LeadsService(prisma as never);

    await expect(
      service.updateForMember(
        {
          workspaceId: 'workspace-1',
          teamId: 'team-1',
          sponsorId: 'sponsor-1',
        },
        'lead-1',
        { status: 'invalid' as never },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.lead.findFirst).not.toHaveBeenCalled();
  });

  it('closes the active assignment when a member marks the lead as won', async () => {
    const assignmentUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const domainEventCreate = jest.fn().mockResolvedValue({});
    const now = new Date('2026-04-01T10:00:00.000Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    const lead = {
      id: 'lead-1',
      workspaceId: 'workspace-1',
      funnelId: 'funnel-1',
      funnelInstanceId: null,
      funnelPublicationId: null,
      visitorId: null,
      sourceChannel: 'form',
      fullName: 'Jane Prospect',
      email: 'jane@example.com',
      phone: '+52 55 5000 1111',
      companyName: 'Acme Health',
      status: 'nurturing',
      qualificationGrade: 'hot',
      summaryText: 'Lead listo para cierre.',
      nextActionLabel: 'Confirmar onboarding.',
      followUpAt: null,
      lastContactedAt: null,
      lastQualifiedAt: null,
      currentAssignmentId: 'assignment-1',
      tags: ['priority'],
      createdAt: new Date('2026-03-31T10:00:00.000Z'),
      updatedAt: new Date('2026-03-31T10:00:00.000Z'),
    };

    const updatedLead = {
      ...lead,
      status: 'won',
      lastQualifiedAt: now,
      updatedAt: now,
    };

    const prisma = {
      lead: {
        findFirst: jest.fn().mockResolvedValue(lead),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            lead: {
              update: jest.fn().mockResolvedValue(updatedLead),
            },
            assignment: {
              updateMany: assignmentUpdateMany,
            },
            domainEvent: {
              create: domainEventCreate,
            },
          }),
      ),
    };

    const service = new LeadsService(prisma as never);
    const result = await service.updateForMember(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
      },
      'lead-1',
      { status: 'won' },
    );

    expect(result.status).toBe('won');
    expect(result.reminderBucket).toBe('none');
    expect(result.playbookKey).toBe('won_handoff');
    expect(assignmentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'assignment-1',
        sponsorId: 'sponsor-1',
        status: {
          not: 'closed',
        },
      },
      data: {
        status: 'closed',
        resolvedAt: now,
      },
    });
    expect(domainEventCreate).toHaveBeenCalled();
  });

  it('auto-accepts the current assignment from the n8n webhook', async () => {
    const lead = {
      id: 'lead-1',
      workspaceId: 'workspace-1',
      visitorId: null,
      status: 'assigned',
      currentAssignment: {
        id: 'assignment-1',
        sponsorId: 'sponsor-1',
        status: 'assigned',
        acceptedAt: null,
      },
    };
    const prisma = {
      lead: {
        findUnique: jest.fn().mockResolvedValue(lead),
      },
      assignment: {
        update: jest.fn(),
      },
      domainEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            assignment: {
              update: jest.fn().mockResolvedValue({
                status: 'accepted',
                acceptedAt: new Date('2026-03-31T20:00:00.000Z'),
              }),
            },
            lead: {
              update: jest.fn().mockResolvedValue({
                status: 'nurturing',
              }),
            },
            domainEvent: {
              create: jest.fn(),
            },
          }),
      ),
    };

    const service = new LeadsService(prisma as never);
    const result = await service.autoAcceptLeadFromWebhook('lead-1');

    expect(prisma.lead.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'lead-1',
      },
      include: {
        currentAssignment: true,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.assignmentStatus).toBe('accepted');
    expect(result.leadStatus).toBe('nurturing');
    expect(result.alreadyAccepted).toBe(false);
  });
});
