import { SponsorsService } from './sponsors.service';

describe('SponsorsService', () => {
  const fixedNow = new Date('2026-03-31T20:00:00.000Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('accepts a member lead and dispatches the outbound rescue webhook', async () => {
    const assignmentUpdate = jest.fn().mockResolvedValue({
      id: 'assignment-1',
      status: 'accepted',
      acceptedAt: fixedNow,
    });
    const leadUpdate = jest.fn().mockResolvedValue({
      id: 'lead-1',
      status: 'nurturing',
    });
    const lead = {
      id: 'lead-1',
      workspaceId: 'workspace-1',
      sourceChannel: 'form',
      fullName: 'Jane Prospect',
      email: 'jane@example.com',
      phone: '+52 55 5000 1111',
      companyName: 'Acme Health',
      qualificationGrade: null,
      summaryText: null,
      nextActionLabel: 'Enviar primer mensaje de rescate.',
      followUpAt: null,
      tags: ['rescue'],
      status: 'assigned',
      funnelInstance: {
        id: 'instance-1',
        name: 'Inmuno Reset',
        code: 'inmuno-reset',
      },
      funnelPublication: {
        id: 'publication-1',
        pathPrefix: '/inmuno',
        domain: {
          host: 'exitosos.com',
        },
      },
      currentAssignment: {
        id: 'assignment-1',
        sponsorId: 'sponsor-1',
        teamId: 'team-1',
        status: 'assigned',
        reason: 'handoff',
        assignedAt: new Date('2026-03-31T19:55:00.000Z'),
        acceptedAt: null,
        updatedAt: new Date('2026-03-31T19:55:00.000Z'),
        sponsor: {
          id: 'sponsor-1',
          displayName: 'Ana Sponsor',
          email: 'ana@example.com',
          phone: '+52 55 2222 3333',
          messagingConnection: {
            id: 'connection-1',
            provider: 'EVOLUTION',
            status: 'connected',
            runtimeContextStatus: 'READY',
            externalInstanceId: 'leadflow-ana',
            phone: '+52 55 2222 3333',
            normalizedPhone: '525522223333',
            automationWebhookUrl: null,
            automationEnabled: true,
          },
        },
        team: {
          id: 'team-1',
          name: 'Rescates',
          code: 'rescates',
        },
      },
    };
    const prisma = {
      lead: {
        findFirst: jest.fn().mockResolvedValue(lead),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            assignment: {
              update: assignmentUpdate,
            },
            lead: {
              update: leadUpdate,
            },
          }),
      ),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'N8N_OUTBOUND_WEBHOOK_URL'
          ? 'https://n8n.example.com/webhook/outbound/rescue'
          : undefined,
      ),
    };
    const n8nAutomationClient = {
      dispatch: jest.fn().mockResolvedValue({
        status: 202,
        data: { queued: true },
        url: 'https://n8n.example.com/webhook/outbound/rescue',
      }),
    };
    const walletEngineService = {
      upsertSponsorAccount: jest.fn(),
      getSponsorKredits: jest.fn(),
    };

    const service = new SponsorsService(
      prisma as never,
      configService as never,
      walletEngineService as never,
      n8nAutomationClient as never,
    );

    const result = await service.acceptLeadForMember(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
      },
      'lead-1',
    );

    expect(result).toEqual({
      ok: true,
      leadId: 'lead-1',
      sponsorId: 'sponsor-1',
      assignmentId: 'assignment-1',
      assignmentStatus: 'accepted',
      leadStatus: 'nurturing',
      acceptedAt: fixedNow.toISOString(),
      alreadyAccepted: false,
    });
    expect(assignmentUpdate).toHaveBeenCalledWith({
      where: {
        id: 'assignment-1',
      },
      data: {
        status: 'accepted',
        acceptedAt: fixedNow,
      },
    });
    expect(leadUpdate).toHaveBeenCalledWith({
      where: {
        id: 'lead-1',
      },
      data: {
        status: 'nurturing',
      },
    });
    expect(n8nAutomationClient.dispatch).toHaveBeenCalledWith(
      'https://n8n.example.com/webhook/outbound/rescue',
      expect.objectContaining({
        event: 'LEAD_OUTBOUND_RESCUE_ACCEPTED',
        leadId: 'lead-1',
        sponsorId: 'sponsor-1',
        assignmentId: 'assignment-1',
        lead: expect.objectContaining({
          normalizedPhone: '525550001111',
        }),
        messagingConnection: expect.objectContaining({
          externalInstanceId: 'leadflow-ana',
        }),
      }),
    );
  });

  it('returns an idempotent response when the lead is already accepted', async () => {
    const prisma = {
      lead: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'lead-1',
          workspaceId: 'workspace-1',
          status: 'nurturing',
          sourceChannel: 'form',
          fullName: 'Jane Prospect',
          email: 'jane@example.com',
          phone: '+52 55 5000 1111',
          companyName: 'Acme Health',
          qualificationGrade: null,
          summaryText: null,
          nextActionLabel: 'Continuar seguimiento.',
          followUpAt: null,
          tags: [],
          funnelInstance: null,
          funnelPublication: null,
          currentAssignment: {
            id: 'assignment-1',
            sponsorId: 'sponsor-1',
            teamId: 'team-1',
            status: 'accepted',
            reason: 'handoff',
            assignedAt: new Date('2026-03-31T19:55:00.000Z'),
            acceptedAt: new Date('2026-03-31T19:58:00.000Z'),
            updatedAt: new Date('2026-03-31T19:58:00.000Z'),
            sponsor: {
              id: 'sponsor-1',
              displayName: 'Ana Sponsor',
              email: 'ana@example.com',
              phone: '+52 55 2222 3333',
              messagingConnection: null,
            },
            team: {
              id: 'team-1',
              name: 'Rescates',
              code: 'rescates',
            },
          },
        }),
      },
      $transaction: jest.fn(),
    };
    const configService = {
      get: jest.fn(),
    };
    const n8nAutomationClient = {
      dispatch: jest.fn(),
    };
    const walletEngineService = {
      upsertSponsorAccount: jest.fn(),
      getSponsorKredits: jest.fn(),
    };

    const service = new SponsorsService(
      prisma as never,
      configService as never,
      walletEngineService as never,
      n8nAutomationClient as never,
    );

    const result = await service.acceptLeadForMember(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
      },
      'lead-1',
    );

    expect(result.assignmentStatus).toBe('accepted');
    expect(result.alreadyAccepted).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(n8nAutomationClient.dispatch).not.toHaveBeenCalled();
  });
});
