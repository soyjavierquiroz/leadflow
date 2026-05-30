import {
  CrmAssignmentEventType,
  CrmAssignmentSource,
  CrmAssignmentStatus,
} from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { CrmAssignmentService } from './crm-assignment.service';
import { CrmConversationOwnershipService } from './crm-conversation-ownership.service';

const now = new Date('2026-05-26T12:00:00.000Z');

const buildService = () => {
  const prisma = {
    sponsor: {
      findUnique: jest.fn(),
    },
    messagingConnection: {
      findUnique: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
    },
    crmLeadAssignment: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;
  const crmAssignmentService = {
    createAssignment: jest.fn(),
    emitAssignmentEvent: jest.fn(),
    autoAcceptAssignment: jest.fn(),
  } as unknown as CrmAssignmentService;

  return {
    prisma,
    crmAssignmentService,
    service: new CrmConversationOwnershipService(
      prisma,
      crmAssignmentService,
    ),
  };
};

describe('CrmConversationOwnershipService', () => {
  it('auto accepts WhatsApp conversation ownership by phone match and receiver sponsor', async () => {
    const { prisma, crmAssignmentService, service } = buildService();
    const assignment = {
      id: 'crm-assignment-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      assignedSponsorId: 'sponsor-1',
      assignmentStatus: CrmAssignmentStatus.pending_assignment,
    };

    prisma.sponsor.findUnique = jest.fn().mockResolvedValue({
      id: 'sponsor-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
    });
    prisma.lead.findFirst = jest.fn().mockResolvedValue({
      id: 'lead-1',
    });
    prisma.crmLeadAssignment.findFirst = jest.fn().mockResolvedValue(
      assignment,
    );
    crmAssignmentService.emitAssignmentEvent = jest.fn().mockResolvedValue({
      id: 'event-1',
    });
    crmAssignmentService.autoAcceptAssignment = jest.fn().mockResolvedValue({
      applied: true,
      reason: 'auto_accepted',
      assignment: {
        ...assignment,
        assignmentStatus: CrmAssignmentStatus.auto_accepted,
        conversationOwnerSponsorId: 'sponsor-1',
      },
    });

    const result = await service.handleWhatsappConversation({
      phoneE164: '+1 (555) 100-2000',
      receiverSponsorId: 'sponsor-1',
      whatsappId: '15551002000@s.whatsapp.net',
      metadata: {
        external_event_id: 'event-1',
      },
      occurredAt: now,
    });

    expect(result).toMatchObject({
      applied: true,
      reason: 'auto_accepted',
      leadId: 'lead-1',
    });
    expect(prisma.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
        }),
      }),
    );
    expect(crmAssignmentService.emitAssignmentEvent).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      eventType: CrmAssignmentEventType.conversation_detected,
      actorSponsorId: 'sponsor-1',
      source: CrmAssignmentSource.whatsapp_inbound,
      metadata: expect.objectContaining({
        assignmentId: 'crm-assignment-1',
        whatsapp_id: '15551002000@s.whatsapp.net',
      }),
    });
    expect(crmAssignmentService.autoAcceptAssignment).toHaveBeenCalledWith({
      assignmentId: 'crm-assignment-1',
      sponsorId: 'sponsor-1',
      source: CrmAssignmentSource.whatsapp_inbound,
      metadata: expect.objectContaining({
        auto_accept_reason: 'whatsapp_conversation_detected',
      }),
      now,
    });
  });

  it('creates an inbound CRM assignment before auto accept when no active assignment exists', async () => {
    const { prisma, crmAssignmentService, service } = buildService();
    const createdAssignment = {
      id: 'crm-assignment-2',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      assignedSponsorId: 'sponsor-1',
    };

    prisma.sponsor.findUnique = jest.fn().mockResolvedValue({
      id: 'sponsor-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
    });
    prisma.lead.findFirst = jest.fn().mockResolvedValue({
      id: 'lead-1',
    });
    prisma.crmLeadAssignment.findFirst = jest.fn().mockResolvedValue(null);
    crmAssignmentService.createAssignment = jest
      .fn()
      .mockResolvedValue(createdAssignment);
    crmAssignmentService.emitAssignmentEvent = jest.fn().mockResolvedValue({
      id: 'event-1',
    });
    crmAssignmentService.autoAcceptAssignment = jest.fn().mockResolvedValue({
      applied: true,
      reason: 'auto_accepted',
      assignment: createdAssignment,
    });

    await service.handleWhatsappConversation({
      phoneE164: '15551002000',
      receiverSponsorId: 'sponsor-1',
      occurredAt: now,
    });

    expect(crmAssignmentService.createAssignment).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      assignedSponsorId: 'sponsor-1',
      assignmentSource: CrmAssignmentSource.whatsapp_inbound,
      metadata: expect.objectContaining({
        created_by: 'crm_conversation_ownership',
      }),
      now,
    });
  });
});
