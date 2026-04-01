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

    const service = new LeadCaptureAssignmentService(
      prisma,
      trackingEventsService,
      messagingAutomationService,
      leadDispatcherService,
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

  it('queries only active sponsors when resolving fallback eligibility', async () => {
    const { service } = buildService();
    const publication = buildPublication();
    const tx = {
      adWheel: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wheel-1',
          participants: [
            { sponsorId: 'sponsor-1' },
            { sponsorId: 'sponsor-2' },
          ],
        }),
      },
      rotationPool: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      sponsor: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    await expect(
      (service as any).resolveFallbackSponsorOrThrow(tx, publication, [
        'sponsor-1',
        'sponsor-2',
      ]),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.rotationPool.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        status: 'active',
        isFallbackPool: true,
      },
      include: {
        members: {
          where: {
            isActive: true,
            sponsorId: {
              in: ['sponsor-1', 'sponsor-2'],
            },
            sponsor: {
              isActive: true,
              status: 'active',
              availabilityStatus: 'available',
            },
          },
          orderBy: {
            position: 'asc',
          },
          include: {
            sponsor: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    expect(tx.sponsor.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        id: {
          in: ['sponsor-1', 'sponsor-2'],
        },
        isActive: true,
        status: 'active',
        availabilityStatus: 'available',
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  });

  it('keeps the lead unassigned when the team has no active ad wheel', async () => {
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
          code: 'NO_ACTIVE_AD_WHEEL',
          message: 'No active ad wheel.',
        }),
      );

    const result = await service.assignLeadToNextSponsor({
      publicationId: publication.id,
      leadId: lead.id,
      triggerEventId: 'trigger-1',
    });

    expect(result.assignment).toBeNull();
    expect(trackingEventsService.recordTrackingEvent).not.toHaveBeenCalled();
  });
});
