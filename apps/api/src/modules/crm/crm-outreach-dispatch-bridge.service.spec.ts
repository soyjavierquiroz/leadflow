import {
  CrmAssignmentStatus,
  CrmOutreachIntentType,
  CrmOutreachStatus,
  LeadSourceChannel,
  LeadStatus,
} from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CrmExternalDispatcherPort } from './crm-external-dispatcher.port';
import { CrmMessageTemplateService } from './crm-message-template.service';
import { CrmOutreachDispatchBridgeService } from './crm-outreach-dispatch-bridge.service';
import { CrmOutreachPolicyService } from './crm-outreach-policy.service';

const now = new Date('2026-05-26T14:00:00.000Z');

const queuedRow = {
  id: 'queue-1',
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  leadId: 'lead-1',
  sponsorId: 'sponsor-1',
  intentType: CrmOutreachIntentType.initial_contact,
  status: CrmOutreachStatus.queued,
  scheduledAt: new Date('2026-05-26T13:00:00.000Z'),
  randomizedDelayMs: 120000,
  payloadJson: {
    assignment_id: 'assignment-1',
    dispatch_enabled: true,
    template: {
      locale: 'es-BO',
    },
  },
  retryCount: 0,
  lastAttemptAt: null,
  nextRetryAt: null,
  failureReason: null,
  createdAt: new Date('2026-05-26T12:00:00.000Z'),
  updatedAt: new Date('2026-05-26T12:00:00.000Z'),
  lead: {
    id: 'lead-1',
    fullName: 'Ana Rivera',
    phone: '+59170000000',
    status: LeadStatus.assigned,
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

const assignment = {
  id: 'assignment-1',
  assignedSponsorId: 'sponsor-1',
  acceptedBySponsorId: 'sponsor-1',
  conversationOwnerSponsorId: null,
  lastConversationAt: null,
  metadataJson: {},
  assignmentStatus: CrmAssignmentStatus.accepted,
};

const buildService = (
  dispatcher: Partial<CrmExternalDispatcherPort> = {},
) => {
  const prisma = {
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]),
    crmOutreachQueue: {
      findMany: jest.fn().mockResolvedValue([queuedRow]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
    },
    crmLeadAssignment: {
      findFirst: jest.fn().mockResolvedValue(assignment),
    },
    domainEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;
  const dispatcherPort = {
    handoffOutreach: jest.fn().mockResolvedValue({
      accepted: true,
      external_id: null,
      reason: 'noop_dry_run',
    }),
    cancelOutreach: jest.fn(),
    getDeliveryStatus: jest.fn(),
    ...dispatcher,
  } as CrmExternalDispatcherPort;

  return {
    prisma,
    dispatcher: dispatcherPort,
    service: new CrmOutreachDispatchBridgeService(
      prisma,
      new CrmOutreachPolicyService(prisma),
      new CrmMessageTemplateService(),
      dispatcherPort,
    ),
  };
};

describe('CrmOutreachDispatchBridgeService', () => {
  it('hands off eligible outreach without logging or auditing full message text', async () => {
    const { prisma, dispatcher, service } = buildService();

    const result = await service.handoffReadyOutreachBatch({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      now,
      random: () => 0,
    });

    expect(result).toEqual({
      scanned: 1,
      claimed: 1,
      handed_off: 1,
      blocked: 0,
      failed: 0,
      retry_scheduled: 0,
      skipped: 0,
    });
    expect(dispatcher.handoffOutreach).toHaveBeenCalledWith(
      expect.objectContaining({
        outreach_id: 'queue-1',
        assignment_id: 'assignment-1',
        workspace_id: 'workspace-1',
        sponsor_id: 'sponsor-1',
        lead: {
          id: 'lead-1',
          first_name: 'Ana',
          phone_e164: '+59170000000',
        },
        campaign: {
          type: 'initial_contact',
          variant_key: 'crm.initial_contact.safe_mlm.v1:0',
        },
      }),
    );
    expect(prisma.crmOutreachQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CrmOutreachStatus.handed_off,
        }),
      }),
    );
    expect(prisma.domainEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventName: 'outreach_handed_off',
          payload: expect.not.objectContaining({
            rendered_preview: expect.any(String),
          }),
        }),
      }),
    );
  });

  it('blocks outreach when MLM policy fails before handoff', async () => {
    const { prisma, dispatcher, service } = buildService();

    await service.handoffReadyOutreachBatch({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      now: new Date('2026-05-26T03:00:00.000Z'),
    });

    expect(dispatcher.handoffOutreach).not.toHaveBeenCalled();
    expect(prisma.crmOutreachQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CrmOutreachStatus.blocked,
          failureReason: expect.objectContaining({
            reason: 'quiet_hours_blocked',
            category: 'mlm_policy',
          }),
        }),
      }),
    );
    expect(prisma.domainEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventName: 'outreach_blocked',
        }),
      }),
    );
  });

  it('schedules exponential retry after dispatcher rejection', async () => {
    const { prisma, service } = buildService({
      handoffOutreach: jest.fn().mockResolvedValue({
        accepted: false,
        reason: 'dispatcher_unavailable',
      }),
    });

    const result = await service.handoffReadyOutreachBatch({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      now,
    });

    expect(result.retry_scheduled).toBe(1);
    expect(prisma.crmOutreachQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CrmOutreachStatus.queued,
          retryCount: 1,
          nextRetryAt: new Date('2026-05-26T14:05:00.000Z'),
          failureReason: expect.objectContaining({
            reason: 'dispatcher_unavailable',
            category: 'dispatcher',
          }),
        }),
      }),
    );
    expect(prisma.domainEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventName: 'outreach_retry_scheduled',
        }),
      }),
    );
  });
});
