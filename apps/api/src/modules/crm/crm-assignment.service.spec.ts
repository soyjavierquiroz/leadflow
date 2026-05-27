import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  CrmAssignmentEventType,
  CrmAssignmentSource,
  CrmAssignmentStatus,
  CrmOutreachIntentType,
  CrmOutreachStatus,
} from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { CrmAssignmentService } from './crm-assignment.service';
import { CrmMessageTemplateService } from './crm-message-template.service';
import { CrmOutreachPolicyService } from './crm-outreach-policy.service';
import { CrmOutreachSchedulerService } from './crm-outreach-scheduler.service';

const now = new Date('2026-05-26T12:00:00.000Z');
const lockedUntil = new Date('2026-05-29T12:00:00.000Z');

const buildAssignment = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: 'crm-assignment-1',
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  leadId: 'lead-1',
  attributedSponsorId: 'sponsor-attributed',
  assignedSponsorId: 'sponsor-1',
  acceptedBySponsorId: null,
  conversationOwnerSponsorId: null,
  assignmentStatus: CrmAssignmentStatus.pending_assignment,
  assignmentSource: CrmAssignmentSource.wheel,
  ownershipLockedUntil: null,
  assignedAt: now,
  acceptedAt: null,
  lastConversationAt: null,
  metadataJson: {},
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const buildService = () => {
  const prisma = {
    $transaction: jest.fn(async (callback) => callback(prisma)),
    crmLeadAssignment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    crmAssignmentEvent: {
      create: jest.fn(),
    },
    crmOutreachQueue: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  } as unknown as PrismaService;
  const outreachScheduler = {
    scheduleInitialContact: jest.fn(),
  } as unknown as CrmOutreachSchedulerService;

  return {
    prisma,
    outreachScheduler,
    service: new CrmAssignmentService(prisma, outreachScheduler),
  };
};

const buildServiceWithRealScheduler = () => {
  const prisma = {
    $transaction: jest.fn(async (callback) => callback(prisma)),
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]),
    crmLeadAssignment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    crmAssignmentEvent: {
      create: jest.fn(),
    },
    crmOutreachQueue: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'queue-1',
          ...data,
        }),
      ),
    },
  } as unknown as PrismaService;
  const policy = new CrmOutreachPolicyService(prisma);
  const templates = new CrmMessageTemplateService();
  const scheduler = new CrmOutreachSchedulerService(
    prisma,
    policy,
    templates,
  );

  return {
    prisma,
    service: new CrmAssignmentService(prisma, scheduler),
  };
};

describe('CrmAssignmentService', () => {
  it('accepts a pending assignment, locks ownership, audits and queues outreach intent only internally', async () => {
    const { prisma, outreachScheduler, service } = buildService();
    const pending = buildAssignment();
    const accepted = buildAssignment({
      assignmentStatus: CrmAssignmentStatus.accepted,
      acceptedBySponsorId: 'sponsor-1',
      acceptedAt: now,
      ownershipLockedUntil: lockedUntil,
    });

    prisma.crmLeadAssignment.findFirst = jest.fn().mockResolvedValue(pending);
    prisma.crmLeadAssignment.update = jest.fn().mockResolvedValue(accepted);
    prisma.crmAssignmentEvent.create = jest.fn().mockResolvedValue({
      id: 'event-1',
    });
    outreachScheduler.scheduleInitialContact = jest.fn().mockResolvedValue({
      id: 'queue-1',
    });

    const result = await service.acceptAssignment({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      sponsorId: 'sponsor-1',
      assignmentId: 'crm-assignment-1',
      now,
    });

    expect(result).toEqual(accepted);
    expect(prisma.crmLeadAssignment.update).toHaveBeenCalledWith({
      where: {
        id: 'crm-assignment-1',
      },
      data: expect.objectContaining({
        assignmentStatus: CrmAssignmentStatus.accepted,
        acceptedAt: now,
        acceptedBySponsorId: 'sponsor-1',
        ownershipLockedUntil: lockedUntil,
      }),
    });
    expect(prisma.crmAssignmentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: CrmAssignmentEventType.assignment_accepted,
        actorSponsorId: 'sponsor-1',
        source: CrmAssignmentSource.wheel,
      }),
    });
    expect(outreachScheduler.scheduleInitialContact).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        leadId: 'lead-1',
        sponsorId: 'sponsor-1',
        assignmentId: 'crm-assignment-1',
        conversationStartedAt: null,
        conversationOwnerSponsorId: null,
        metadata: {
          source: 'manual_accept',
        },
      }),
    );
  });

  it('accept crea queue cuando elegible', async () => {
    const { prisma, service } = buildServiceWithRealScheduler();
    const pending = buildAssignment();
    const accepted = buildAssignment({
      assignmentStatus: CrmAssignmentStatus.accepted,
      acceptedBySponsorId: 'sponsor-1',
      acceptedAt: now,
      ownershipLockedUntil: lockedUntil,
    });

    prisma.crmLeadAssignment.findFirst = jest.fn().mockResolvedValue(pending);
    prisma.crmLeadAssignment.update = jest.fn().mockResolvedValue(accepted);
    prisma.crmAssignmentEvent.create = jest.fn().mockResolvedValue({
      id: 'event-1',
    });

    await service.acceptAssignment({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      sponsorId: 'sponsor-1',
      assignmentId: 'crm-assignment-1',
      now,
    });

    expect(prisma.crmOutreachQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead-1',
        sponsorId: 'sponsor-1',
        intentType: CrmOutreachIntentType.initial_contact,
        status: CrmOutreachStatus.queued,
        payloadJson: expect.objectContaining({
          dispatch_enabled: false,
          metadata: {
            source: 'manual_accept',
          },
        }),
      }),
    });
  });

  it('accept NO crea queue cuando bloqueado', async () => {
    const { prisma, service } = buildServiceWithRealScheduler();
    const pending = buildAssignment();
    const accepted = buildAssignment({
      assignmentStatus: CrmAssignmentStatus.accepted,
      acceptedBySponsorId: 'sponsor-1',
      acceptedAt: now,
      lastConversationAt: now,
      ownershipLockedUntil: lockedUntil,
    });

    prisma.crmLeadAssignment.findFirst = jest.fn().mockResolvedValue(pending);
    prisma.crmLeadAssignment.update = jest.fn().mockResolvedValue(accepted);
    prisma.crmAssignmentEvent.create = jest.fn().mockResolvedValue({
      id: 'event-1',
    });

    await service.acceptAssignment({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      sponsorId: 'sponsor-1',
      assignmentId: 'crm-assignment-1',
      now,
    });

    expect(prisma.crmOutreachQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        intentType: CrmOutreachIntentType.initial_contact,
        status: 'blocked',
        payloadJson: expect.objectContaining({
          blocked_reason: 'conversation_already_started',
          dispatch_enabled: false,
        }),
      }),
    });
    const createCall = (prisma.crmOutreachQueue.create as jest.Mock).mock
      .calls[0][0];
    expect(createCall.data.status).not.toBe(CrmOutreachStatus.queued);
  });

  it('keeps accept idempotent for the same sponsor without duplicate audit or queue rows', async () => {
    const { prisma, outreachScheduler, service } = buildService();
    const accepted = buildAssignment({
      assignmentStatus: CrmAssignmentStatus.accepted,
      acceptedBySponsorId: 'sponsor-1',
      acceptedAt: now,
    });

    prisma.crmLeadAssignment.findFirst = jest.fn().mockResolvedValue(accepted);

    await expect(
      service.acceptAssignment({
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
        assignmentId: 'crm-assignment-1',
        now,
      }),
    ).resolves.toEqual(accepted);

    expect(prisma.crmLeadAssignment.update).not.toHaveBeenCalled();
    expect(prisma.crmAssignmentEvent.create).not.toHaveBeenCalled();
    expect(outreachScheduler.scheduleInitialContact).not.toHaveBeenCalled();
  });

  it('isolates sponsor acceptance by assigned sponsor ownership', async () => {
    const { prisma, outreachScheduler, service } = buildService();

    prisma.crmLeadAssignment.findFirst = jest.fn().mockResolvedValue(
      buildAssignment({
        assignedSponsorId: 'other-sponsor',
      }),
    );

    await expect(
      service.acceptAssignment({
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
        assignmentId: 'crm-assignment-1',
        now,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects auto accept when another sponsor has an active lock conflict', async () => {
    const { prisma, outreachScheduler, service } = buildService();

    prisma.crmLeadAssignment.findUnique = jest.fn().mockResolvedValue(
      buildAssignment({
        assignedSponsorId: 'other-sponsor',
        ownershipLockedUntil: lockedUntil,
      }),
    );

    const result = await service.autoAcceptAssignment({
      assignmentId: 'crm-assignment-1',
      sponsorId: 'sponsor-1',
      now,
    });

    expect(result).toMatchObject({
      applied: false,
      reason: 'lock_conflict',
    });
    expect(prisma.crmLeadAssignment.update).not.toHaveBeenCalled();
    expect(outreachScheduler.scheduleInitialContact).not.toHaveBeenCalled();
  });

  it('auto accepts a conversational owner without creating outreach', async () => {
    const { prisma, outreachScheduler, service } = buildService();
    const pending = buildAssignment({
      assignedSponsorId: null,
    });
    const autoAccepted = buildAssignment({
      assignedSponsorId: 'sponsor-1',
      conversationOwnerSponsorId: 'sponsor-1',
      assignmentStatus: CrmAssignmentStatus.auto_accepted,
      acceptedAt: now,
      lastConversationAt: now,
      ownershipLockedUntil: lockedUntil,
    });

    prisma.crmLeadAssignment.findUnique = jest.fn().mockResolvedValue(pending);
    prisma.crmLeadAssignment.update = jest.fn().mockResolvedValue(autoAccepted);
    prisma.crmAssignmentEvent.create = jest.fn().mockResolvedValue({
      id: 'event-1',
    });
    prisma.crmOutreachQueue.create = jest.fn().mockResolvedValue({
      id: 'queue-1',
    });

    const result = await service.autoAcceptAssignment({
      assignmentId: 'crm-assignment-1',
      sponsorId: 'sponsor-1',
      now,
    });

    expect(result).toMatchObject({
      applied: true,
      reason: 'auto_accepted',
      assignment: autoAccepted,
    });
    expect(prisma.crmAssignmentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: CrmAssignmentEventType.assignment_auto_accepted,
        actorSponsorId: 'sponsor-1',
        source: CrmAssignmentSource.whatsapp_inbound,
      }),
    });
    expect(outreachScheduler.scheduleInitialContact).not.toHaveBeenCalled();
  });

  it('does not reassign while ownership is locked without explicit override', async () => {
    const { prisma, service } = buildService();

    prisma.crmLeadAssignment.findUnique = jest.fn().mockResolvedValue(
      buildAssignment({
        ownershipLockedUntil: lockedUntil,
      }),
    );

    await expect(
      service.reassignAssignment({
        assignmentId: 'crm-assignment-1',
        targetSponsorId: 'sponsor-2',
        now,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.crmLeadAssignment.update).not.toHaveBeenCalled();
  });
});
