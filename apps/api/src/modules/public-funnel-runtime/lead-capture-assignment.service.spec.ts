import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { LeadCaptureAssignmentService } from './lead-capture-assignment.service';

const buildPublication = () =>
  ({
    id: 'publication-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    funnelInstanceId: 'funnel-1',
    metaPixelId: 'meta-pixel-1',
    metaCapiToken: 'meta-token-1',
    tiktokPixelId: 'tt-pixel-1',
    tiktokAccessToken: 'tt-token-1',
    pathPrefix: '/demo',
    domain: {
      host: 'promo.example.com',
      status: 'active',
    },
    handoffStrategy: null,
    funnelInstance: {
      id: 'funnel-1',
      name: 'Demo Funnel',
      handoffStrategy: null,
      funnelId: 'legacy-funnel-1',
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
      adWheel: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
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
        attributionType: 'organic',
        attributionSlug: null,
        runtimePathPrefix: null,
        referralQueryParam: null,
      }),
    } as any;
    const mailerService = {
      sendAdvisorLeadAssignmentEmail: jest.fn().mockResolvedValue(undefined),
    } as any;
    const capiManagerService = {
      dispatchLeadConversion: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new LeadCaptureAssignmentService(
      prisma,
      trackingEventsService,
      messagingAutomationService,
      leadDispatcherService,
      publicFunnelRuntimeService,
      mailerService,
      capiManagerService,
    );

    return {
      capiManagerService,
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

  it('queues a blind attribution decision for CAPI using request headers without blocking the response', async () => {
    const { capiManagerService, prisma, service } = buildService();
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
        phone: '+57 300 000 0001',
      },
      wasCreated: true,
    });
    jest
      .spyOn(service as any, 'assignLeadOrLeaveUnassignedInTransaction')
      .mockResolvedValue({
        assignment: null,
        advisor: null,
        wasCreated: false,
      });

    await service.submitLeadCapture(
      {
        publicationId: publication.id,
        anonymousId: 'anon-1',
        currentStepId: 'step-1',
        sourceChannel: 'form',
        sourceUrl: 'https://promo.example.com/promo/wheel-1',
        fbclid: 'fbclid-123',
        fullName: 'Lead Demo',
        email: 'lead@example.com',
        phone: '+57 300 000 0001',
        companyName: null,
        fieldValues: {},
        tags: [],
      },
      {
        'cf-connecting-ip': '203.0.113.10',
        'user-agent': 'LeadflowTestAgent/1.0',
      },
    );

    expect(capiManagerService.dispatchLeadConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        lead: expect.objectContaining({
          id: 'lead-1',
        }),
        attributionDecision: expect.objectContaining({
          fbclid: 'fbclid-123',
          clientIpAddress: '203.0.113.10',
          clientUserAgent: 'LeadflowTestAgent/1.0',
          requestedPath: '/promo/wheel-1',
        }),
      }),
    );
  });

  it('forces organic attribution on a generic path without campaign evidence even when a wheel is active', async () => {
    const { prisma, service } = buildService();
    const publication = buildPublication();

    (prisma.adWheel.findFirst as jest.Mock).mockResolvedValue({
      id: 'wheel-active-1',
    });

    const entryContext = await (service as any).resolveSubmissionEntryContext(
      prisma,
      publication,
      'https://promo.example.com/demo',
      {
        entryMode: 'paid_ads',
        trafficLayer: 'PAID_WHEEL',
        forcedSponsorId: null,
        adWheelId: 'wheel-stale-1',
        browserPixelsEnabled: true,
        attributionType: 'promo',
        attributionSlug: 'wheel-stale-1',
        runtimePathPrefix: '/demo',
        referralQueryParam: null,
      },
      {
        sourceUrl: 'https://promo.example.com/demo',
        utmSource: null,
        utmCampaign: null,
        utmMedium: null,
        utmContent: null,
        utmTerm: null,
        fbclid: null,
        gclid: null,
        ttclid: null,
      },
    );

    expect(entryContext).toMatchObject({
      entryMode: 'paid_ads',
      trafficLayer: 'ORGANIC',
      adWheelId: null,
      attributionType: 'organic',
      attributionSlug: null,
    });
  });

  it('marks a generic funnel as PAID_ADS only when the url contains physical tracking evidence', async () => {
    const { prisma, service } = buildService();
    const publication = buildPublication();

    (prisma.adWheel.findFirst as jest.Mock).mockResolvedValue({
      id: 'wheel-active-1',
    });

    const entryContext = await (service as any).resolveSubmissionEntryContext(
      prisma,
      publication,
      'https://promo.example.com/funnel2?fbclid=fbclid-123',
      {
        entryMode: 'paid_ads',
        trafficLayer: 'ORGANIC',
        forcedSponsorId: null,
        adWheelId: null,
        browserPixelsEnabled: true,
        attributionType: 'organic',
        attributionSlug: null,
        runtimePathPrefix: '/funnel2',
        referralQueryParam: null,
      },
      {
        sourceUrl: 'https://promo.example.com/funnel2?fbclid=fbclid-123',
        utmSource: null,
        utmCampaign: null,
        utmMedium: null,
        utmContent: null,
        utmTerm: null,
        fbclid: 'fbclid-123',
        gclid: null,
        ttclid: null,
      },
    );

    expect(entryContext).toMatchObject({
      entryMode: 'paid_ads',
      trafficLayer: 'PAID_ADS',
      adWheelId: null,
      attributionType: 'organic',
      attributionSlug: 'ads',
    });
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
          trafficLayer: 'DIRECT',
          forcedSponsorId: 'sponsor-1',
          adWheelId: null,
          browserPixelsEnabled: false,
          attributionType: 'ref',
          attributionSlug: 'asesor-1',
          runtimePathPrefix: '/ref/asesor-1',
          referralQueryParam: null,
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
        attributionType: 'ref',
        attributionSlug: 'asesor-uno',
        runtimePathPrefix: '/ref/asesor-uno',
      },
    );

    expect(nextStep).toEqual({
      id: 'step-2',
      slug: 'gracias',
      path: '/ref/asesor-uno/gracias',
      stepType: 'thank_you',
    });
  });

  it('reserves the current paid wheel cycle slot and advances the cursor', async () => {
    const { service } = buildService();
    const publication = buildPublication();
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'wheel-1',
            currentTurnPosition: 2,
            sequenceVersion: 3,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'turn-2',
            adWheelId: 'wheel-1',
            sponsorId: 'sponsor-2',
            position: 2,
            sequenceVersion: 3,
            displayName: 'Advisor Dos',
            email: 'advisor2@example.com',
            phone: '+57 300 000 0002',
            avatarUrl: null,
          },
        ]),
      adWheelTurn: {
        count: jest.fn().mockResolvedValue(3),
      },
      adWheel: {
        update: jest.fn().mockResolvedValue({ id: 'wheel-1' }),
      },
    };

    const reservation = await (
      service as any
    ).reservePaidWheelCycleTurnInTransaction(tx, publication, 'wheel-1');

    expect(tx.adWheel.update).toHaveBeenCalledWith({
      where: {
        id: 'wheel-1',
      },
      data: {
        currentTurnPosition: 3,
      },
      select: {
        id: true,
      },
    });
    expect(reservation).toMatchObject({
      adWheelId: 'wheel-1',
      turnId: 'turn-2',
      turnPosition: 2,
      sequenceVersion: 3,
      totalTurns: 3,
      sponsor: {
        id: 'sponsor-2',
      },
    });
  });

  it('wraps the paid wheel cursor back to position 1 after the last turn', async () => {
    const { service } = buildService();
    const publication = buildPublication();
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'wheel-1',
            currentTurnPosition: 3,
            sequenceVersion: 3,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'turn-3',
            adWheelId: 'wheel-1',
            sponsorId: 'sponsor-3',
            position: 3,
            sequenceVersion: 3,
            displayName: 'Advisor Tres',
            email: 'advisor3@example.com',
            phone: '+57 300 000 0003',
            avatarUrl: null,
          },
        ]),
      adWheelTurn: {
        count: jest.fn().mockResolvedValue(3),
      },
      adWheel: {
        update: jest.fn().mockResolvedValue({ id: 'wheel-1' }),
      },
    };

    await (service as any).reservePaidWheelCycleTurnInTransaction(
      tx,
      publication,
      'wheel-1',
    );

    expect(tx.adWheel.update).toHaveBeenCalledWith({
      where: {
        id: 'wheel-1',
      },
      data: {
        currentTurnPosition: 1,
      },
      select: {
        id: true,
      },
    });
  });

  it('leaves the lead unassigned when the paid wheel cannot reserve a turn', async () => {
    const { service } = buildService();

    jest
      .spyOn(service as any, 'assignLeadToNextSponsorInTransaction')
      .mockRejectedValue(
        new ConflictException({
          code: 'NO_AVAILABLE_AD_WHEEL_TURNS',
          message: 'No eligible paid wheel turn found.',
        }),
      );

    await expect(
      (service as any).assignLeadOrLeaveUnassignedInTransaction(
        {},
        buildPublication(),
        {
          id: 'lead-1',
          currentAssignmentId: null,
        },
        {
          entryContext: {
            entryMode: 'paid_ads',
            trafficLayer: 'PAID_WHEEL',
            forcedSponsorId: null,
            adWheelId: 'wheel-1',
            browserPixelsEnabled: true,
            attributionType: 'promo',
            attributionSlug: 'wheel-1',
            runtimePathPrefix: null,
            referralQueryParam: null,
          },
        },
      ),
    ).resolves.toEqual({
      assignment: null,
      advisor: null,
      wasCreated: false,
    });
  });

  it('drops a stale originAdWheelId before lead persistence and still captures the lead', async () => {
    const { service, trackingEventsService } = buildService();
    const publication = buildPublication();
    const tx = {
      adWheel: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      lead: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'lead-1',
          sourceChannel: 'form',
        }),
      },
      visitor: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      domainEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    const result = await (service as any).captureLeadInTransaction(
      tx,
      publication,
      { id: 'visitor-1' },
      {
        publicationId: publication.id,
        visitorId: 'visitor-1',
        anonymousId: 'anon-1',
        sourceChannel: 'form',
        fullName: 'Lead Demo',
        email: 'lead@example.com',
        phone: null,
        companyName: null,
        fieldValues: {},
        tags: [],
        trafficLayer: 'PAID_WHEEL',
        originAdWheelId: 'wheel-1',
      },
    );

    expect(tx.adWheel.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'wheel-1',
      },
      select: {
        id: true,
      },
    });
    expect(tx.lead.upsert).toHaveBeenCalledTimes(1);
    expect(tx.lead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          originAdWheelId: null,
          trafficLayer: 'PAID_WHEEL',
        }),
      }),
    );
    expect(trackingEventsService.recordTrackingEventInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventName: 'lead_created',
      }),
    );
    expect(result).toEqual({
      lead: {
        id: 'lead-1',
        sourceChannel: 'form',
      },
      wasCreated: true,
    });
  });
});
