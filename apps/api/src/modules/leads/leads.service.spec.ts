import { LeadsService } from './leads.service';

describe('LeadsService', () => {
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
