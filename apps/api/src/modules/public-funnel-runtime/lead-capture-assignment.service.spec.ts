import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { LeadCaptureAssignmentService } from './lead-capture-assignment.service';

const buildPublication = () =>
  ({
    id: 'publication-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    funnelInstanceId: 'funnel-1',
    pathPrefix: '/demo',
    handoffStrategy: null,
    funnelInstance: {
      id: 'funnel-1',
      name: 'Demo Funnel',
      handoffStrategy: null,
      legacyFunnelId: 'legacy-funnel-1',
      steps: [
        {
          id: 'step-1',
          slug: 'landing',
          isEntryStep: true,
          stepType: 'landing',
        },
        {
          id: 'step-2',
          slug: 'gracias',
          isEntryStep: false,
          stepType: 'thank_you',
        },
      ],
    },
  }) as any;

describe('LeadCaptureAssignmentService', () => {
  const buildService = () => {
    const prisma = {
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const trackingEventsService = {
      recordTrackingEvent: jest.fn(),
      recordTrackingEventInTransaction: jest.fn(),
    } as any;
    const messagingAutomationService = {
      dispatchAssignmentAutomation: jest.fn().mockResolvedValue(undefined),
    } as any;
    const leadDispatcherService = {
      dispatchLeadContextUpsert: jest.fn().mockResolvedValue(undefined),
    } as any;
    const publicFunnelRuntimeService = {
      resolveEntryContextForPublication: jest.fn().mockResolvedValue({
        entryMode: 'paid_ads',
        trafficLayer: 'ORGANIC',
        forcedSponsorId: null,
        adWheelId: null,
        browserPixelsEnabled: true,
        runtimePathPrefix: null,
      }),
    } as any;
    const mailerService = {
      sendAdvisorLeadAssignmentEmail: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new LeadCaptureAssignmentService(
      prisma,
      trackingEventsService,
      messagingAutomationService,
      leadDispatcherService,
      publicFunnelRuntimeService,
      mailerService,
    );

    return {
      prisma,
      service,
      trackingEventsService,
    };
  };

  it('keeps the lead unassigned when no active sponsors are available during submit', async () => {
    const { prisma, service, trackingEventsService } = buildService();
    const publication = buildPublication();
    const tx = {};

    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback(tx),
    );

    jest
      .spyOn(service as any, 'getPublicationContextOrThrow')
      .mockResolvedValue(publication);
    jest
      .spyOn(service as any, 'registerVisitorInTransaction')
      .mockResolvedValue({ id: 'visitor-1' });
    jest.spyOn(service as any, 'captureLeadInTransaction').mockResolvedValue({
      lead: {
        id: 'lead-1',
        fullName: 'Lead Demo',
        email: 'lead@example.com',
        phone: null,
      },
      wasCreated: true,
    });
    jest
      .spyOn(service as any, 'assignLeadToNextSponsorInTransaction')
      .mockRejectedValue(
        new ConflictException({
          code: 'NO_FALLBACK_SPONSOR_AVAILABLE',
          message: 'No sponsors available.',
        }),
      );

    const result = await service.submitLeadCapture({
      publicationId: publication.id,
      anonymousId: 'anon-1',
      currentStepId: 'step-1',
      sourceChannel: 'form',
      fullName: 'Lead Demo',
      email: 'lead@example.com',
      phone: null,
      companyName: null,
      fieldValues: {},
      tags: [],
    });

    expect(result.lead.id).toBe('lead-1');
    expect(result.assignment).toBeNull();
    expect(result.advisor).toBeNull();
    expect(result.assigned_advisor).toBeNull();
    expect(trackingEventsService.recordTrackingEvent).not.toHaveBeenCalled();
  });

  it('returns the assigned advisor payload expected by the conversion handoff widget', async () => {
    const { prisma, service } = buildService();
    const publication = buildPublication();
    const tx = {};

    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback(tx),
    );

    jest
      .spyOn(service as any, 'getPublicationContextOrThrow')
      .mockResolvedValue(publication);
    jest
      .spyOn(service as any, 'registerVisitorInTransaction')
      .mockResolvedValue({
        id: 'visitor-1',
        anonymousId: 'anon-1',
      });
    jest.spyOn(service as any, 'captureLeadInTransaction').mockResolvedValue({
      lead: {
        id: 'lead-1',
        fullName: 'Lead Demo',
        email: 'lead@example.com',
        phone: '+57 300 100 1000',
      },
      wasCreated: true,
    });
    jest
      .spyOn(service as any, 'assignLeadToNextSponsorInTransaction')
      .mockResolvedValue({
        assignment: {
          id: 'assignment-1',
          status: 'assigned',
          reason: 'rotation',
          assignedAt: '2026-04-17T00:00:00.000Z',
          sponsor: {
            id: 'sponsor-1',
            displayName: 'Advisor Uno',
            email: 'advisor@example.com',
            phone: '+57 300 000 0001',
            avatarUrl: 'https://cdn.example.com/a1.png',
          },
        },
        advisor: {
          id: 'advisor-1',
          sponsorId: 'sponsor-1',
          name: 'Advisor Uno',
          role: 'Asesor',
          bio: 'Asesor',
          phone: '+57 300 000 0001',
          photoUrl: 'https://cdn.example.com/a1.png',
        },
        wasCreated: true,
      });

    const result = await service.submitLeadCapture({
      publicationId: publication.id,
      anonymousId: 'anon-1',
      currentStepId: 'step-1',
      sourceChannel: 'form',
      fullName: 'Lead Demo',
      email: 'lead@example.com',
      phone: '+57 300 100 1000',
      companyName: null,
      fieldValues: {},
      tags: [],
    });

    expect(result.advisor).toEqual({
      name: 'Advisor Uno',
      role: 'Asesor',
      bio: 'Asesor',
      phone: '+57 300 000 0001',
      photoUrl: 'https://cdn.example.com/a1.png',
      whatsappUrl: 'https://wa.me/573000000001',
    });
    expect(result.assigned_advisor).toEqual({
      name: 'Advisor Uno',
      role: 'Asesor',
      bio: 'Asesor',
      phone: '+57 300 000 0001',
      photo_url: 'https://cdn.example.com/a1.png',
    });
  });

  it('returns a safe auto-assignment response when the team has zero active sponsors', async () => {
    const { prisma, service, trackingEventsService } = buildService();
    const publication = buildPublication();
    const lead = {
      id: 'lead-1',
      currentAssignmentId: null,
    };
    const tx = {
      lead: {
        findFirst: jest.fn().mockResolvedValue(lead),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback(tx),
    );

    jest
      .spyOn(service as any, 'getPublicationContextOrThrow')
      .mockResolvedValue(publication);
    jest
      .spyOn(service as any, 'assignLeadToNextSponsorInTransaction')
      .mockRejectedValue(
        new ConflictException({
          code: 'NO_FALLBACK_SPONSOR_AVAILABLE',
          message: 'No sponsors available.',
        }),
      );

    const result = await service.assignLeadToNextSponsor({
      publicationId: publication.id,
      leadId: lead.id,
      triggerEventId: 'trigger-1',
    });

    expect(tx.lead.findFirst).toHaveBeenCalledWith({
      where: {
        id: lead.id,
        workspaceId: publication.workspaceId,
      },
    });
    expect(result.assignment).toBeNull();
    expect(result.nextStep).toEqual({
      id: 'step-2',
      slug: 'gracias',
      path: '/demo/gracias',
      stepType: 'thank_you',
    });
    expect(trackingEventsService.recordTrackingEvent).not.toHaveBeenCalled();
  });

  it('selects the next active advisor by team pointer and updates the pointer', async () => {
    const { service } = buildService();
    const publication = buildPublication();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: publication.teamId,
          lastAssignedUserId: 'advisor-1',
        },
      ]),
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'advisor-1',
            fullName: 'Advisor Uno',
            role: 'MEMBER',
            sponsor: {
              id: 'sponsor-1',
              displayName: 'Advisor Uno',
              phone: '+57 300 000 0001',
              avatarUrl: 'https://cdn.example.com/a1.png',
            },
          },
          {
            id: 'advisor-2',
            fullName: 'Advisor Dos',
            role: 'MEMBER',
            sponsor: {
              id: 'sponsor-2',
              displayName: 'Advisor Dos',
              phone: '+57 300 000 0002',
              avatarUrl: 'https://cdn.example.com/a2.png',
            },
          },
        ]),
      },
      team: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const result = await (service as any).resolveRoundRobinAssigneeOrThrow(
      tx,
      publication,
    );

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        role: {
          in: ['MEMBER', 'TEAM_ADMIN'],
        },
        status: 'active',
        sponsor: {
          is: {
            isActive: true,
            status: 'active',
            availabilityStatus: 'available',
          },
        },
      },
      include: {
        sponsor: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    expect(tx.team.update).toHaveBeenCalledWith({
      where: {
        id: publication.teamId,
      },
      data: {
        lastAssignedUserId: 'advisor-2',
      },
    });
    expect(result).toMatchObject({
      reason: 'rotation',
      user: {
        id: 'advisor-2',
      },
    });
  });

  it('includes active team admins in the round-robin pool', async () => {
    const { service } = buildService();
    const publication = buildPublication();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: publication.teamId,
          lastAssignedUserId: 'advisor-1',
        },
      ]),
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'advisor-1',
            fullName: 'Advisor Uno',
            role: 'MEMBER',
            sponsor: {
              id: 'sponsor-1',
              displayName: 'Advisor Uno',
              phone: '+57 300 000 0001',
              avatarUrl: 'https://cdn.example.com/a1.png',
            },
          },
          {
            id: 'admin-1',
            fullName: 'Freddy',
            role: 'TEAM_ADMIN',
            sponsor: {
              id: 'sponsor-admin-1',
              displayName: 'Freddy',
              phone: '+57 300 000 0099',
              avatarUrl: 'https://cdn.example.com/admin.png',
            },
          },
        ]),
      },
      team: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const result = await (service as any).resolveRoundRobinAssigneeOrThrow(
      tx,
      publication,
    );

    expect(tx.team.update).toHaveBeenCalledWith({
      where: {
        id: publication.teamId,
      },
      data: {
        lastAssignedUserId: 'admin-1',
      },
    });
    expect(result).toMatchObject({
      reason: 'rotation',
      user: {
        id: 'admin-1',
        role: 'TEAM_ADMIN',
      },
    });
  });

  it('falls back to the team admin when there are no active advisors', async () => {
    const { service } = buildService();
    const publication = buildPublication();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: publication.teamId,
          lastAssignedUserId: null,
        },
      ]),
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'admin-1',
          fullName: 'Admin Owner',
          role: 'TEAM_ADMIN',
          sponsor: {
            id: 'sponsor-admin',
            displayName: 'Admin Owner',
            phone: '+57 300 000 0099',
            avatarUrl: 'https://cdn.example.com/admin.png',
          },
        }),
      },
      team: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const result = await (service as any).resolveRoundRobinAssigneeOrThrow(
      tx,
      publication,
    );

    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        role: 'TEAM_ADMIN',
        status: 'active',
        sponsor: {
          is: {
            isActive: true,
            status: 'active',
            availabilityStatus: 'available',
          },
        },
      },
      include: {
        sponsor: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    expect(tx.team.update).toHaveBeenCalledWith({
      where: {
        id: publication.teamId,
      },
      data: {
        lastAssignedUserId: 'admin-1',
      },
    });
    expect(result).toMatchObject({
      reason: 'fallback',
      user: {
        id: 'admin-1',
      },
    });
  });

  it('creates a direct manual assignment for personal advisor links without moving the team pointer', async () => {
    const { service, trackingEventsService } = buildService();
    const publication = buildPublication();
    const assignedAt = new Date('2026-04-18T00:00:00.000Z');
    const tx = {
      assignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          status: 'assigned',
          reason: 'manual',
          assignedAt,
          sponsor: {
            id: 'sponsor-1',
            displayName: 'Advisor Uno',
            email: 'advisor@example.com',
            phone: '+57 300 000 0001',
            avatarUrl: 'https://cdn.example.com/a1.png',
          },
        }),
      },
      sponsor: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sponsor-1',
          displayName: 'Advisor Uno',
          email: 'advisor@example.com',
          phone: '+57 300 000 0001',
          avatarUrl: 'https://cdn.example.com/a1.png',
        }),
      },
      lead: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      domainEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      team: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const result = await (service as any).assignLeadToNextSponsorInTransaction(
      tx,
      publication,
      {
        id: 'lead-1',
        currentAssignmentId: null,
      },
      {
        triggerEventId: 'trigger-1',
        funnelStepId: 'step-1',
        entryContext: {
          entryMode: 'organic_asesor',
          forcedSponsorId: 'sponsor-1',
          browserPixelsEnabled: false,
        },
      },
    );

    expect(tx.sponsor.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'sponsor-1',
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        isActive: true,
        status: 'active',
        availabilityStatus: 'available',
      },
    });
    expect(tx.assignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead-1',
        sponsorId: 'sponsor-1',
        reason: 'manual',
        rotationPoolId: null,
      }),
      include: {
        sponsor: true,
      },
    });
    expect(tx.team.update).not.toHaveBeenCalled();
    expect(trackingEventsService.recordTrackingEventInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventName: 'assignment_created',
        payload: expect.objectContaining({
          assignmentReason: 'manual',
          assignmentMode: 'organic_asesor_bypass',
          forcedSponsorId: 'sponsor-1',
          teamPointerUnaffected: true,
        }),
      }),
    );
    expect(result.assignment).toMatchObject({
      id: 'assignment-1',
      reason: 'manual',
    });
  });

  it('preserves direct referral context when building the post-capture next step', () => {
    const { service } = buildService();
    const publication = buildPublication();

    const nextStep = (service as any).resolveNextStepAfterCaptureFromPublication(
      publication,
      'step-1',
      {
        entryMode: 'organic_asesor',
        trafficLayer: 'DIRECT',
        forcedSponsorId: 'sponsor-1',
        adWheelId: null,
        browserPixelsEnabled: false,
        runtimePathPrefix: '/demo/ref/asesor-uno',
      },
    );

    expect(nextStep).toEqual({
      id: 'step-2',
      slug: 'gracias',
      path: '/demo/ref/asesor-uno/gracias',
      stepType: 'thank_you',
    });
  });

  it('consumes an ad wheel turn and debits one participant seat atomically', async () => {
    const { service, trackingEventsService } = buildService();
    const publication = buildPublication();
    const assignedAt = new Date('2026-04-18T00:00:00.000Z');
    const tx = {
      adWheelTurn: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'turn-1',
          adWheelId: 'wheel-1',
          sponsorId: 'sponsor-1',
          position: 1,
          sponsor: {
            id: 'sponsor-1',
            displayName: 'Advisor Uno',
            email: 'advisor@example.com',
            phone: '+57 300 000 0001',
            avatarUrl: 'https://cdn.example.com/a1.png',
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      adWheelParticipant: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      assignment: {
        create: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          status: 'assigned',
          reason: 'rotation',
          assignedAt,
          sponsor: {
            id: 'sponsor-1',
            displayName: 'Advisor Uno',
            email: 'advisor@example.com',
            phone: '+57 300 000 0001',
            avatarUrl: 'https://cdn.example.com/a1.png',
          },
        }),
      },
      lead: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      domainEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const result = await (service as any).assignLeadToAdWheelTurnInTransaction(
      tx,
      publication,
      {
        id: 'lead-1',
        currentAssignmentId: null,
      },
      'wheel-1',
      {
        triggerEventId: 'trigger-1',
        funnelStepId: 'step-1',
        entryContext: {
          entryMode: 'paid_ads',
          trafficLayer: 'PAID_WHEEL',
          forcedSponsorId: null,
          adWheelId: 'wheel-1',
          browserPixelsEnabled: true,
        },
      },
    );

    expect(tx.adWheelTurn.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'turn-1',
        isConsumed: false,
      },
      data: {
        isConsumed: true,
        assignmentId: expect.any(String),
      },
    });
    expect(tx.adWheelParticipant.updateMany).toHaveBeenCalledWith({
      where: {
        adWheelId: 'wheel-1',
        sponsorId: 'sponsor-1',
        seatCount: {
          gt: 0,
        },
      },
      data: {
        seatCount: {
          decrement: 1,
        },
      },
    });
    expect(tx.assignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead-1',
        sponsorId: 'sponsor-1',
        trafficLayer: 'PAID_WHEEL',
        originAdWheelId: 'wheel-1',
        reason: 'rotation',
      }),
      include: {
        sponsor: true,
      },
    });
    expect(trackingEventsService.recordTrackingEventInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventName: 'assignment_created',
        payload: expect.objectContaining({
          trafficLayer: 'PAID_WHEEL',
          adWheelId: 'wheel-1',
          adWheelTurnId: 'turn-1',
        }),
      }),
    );
    expect(result.assignment).toMatchObject({
      id: 'assignment-1',
      reason: 'rotation',
    });
  });
});
