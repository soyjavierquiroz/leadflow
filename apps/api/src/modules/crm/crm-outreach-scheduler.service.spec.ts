import { CrmOutreachIntentType, CrmOutreachStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { CrmMessageTemplateService } from './crm-message-template.service';
import type { CrmOutreachPolicyService } from './crm-outreach-policy.service';
import { CrmOutreachSchedulerService } from './crm-outreach-scheduler.service';

const now = new Date('2026-05-26T12:00:00.000Z');

const buildService = () => {
  const prisma = {
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
  const policy = {
    evaluateLeadEligibility: jest.fn(),
  } as unknown as CrmOutreachPolicyService;
  const templates = new CrmMessageTemplateService();

  return {
    prisma,
    policy,
    service: new CrmOutreachSchedulerService(prisma, policy, templates),
  };
};

describe('CrmOutreachSchedulerService', () => {
  it('crea queued', async () => {
    const { prisma, policy, service } = buildService();
    policy.evaluateLeadEligibility = jest.fn().mockResolvedValue({
      eligible: true,
      reason: null,
      rate_limits: {
        initial_contact_last_15_min: 0,
        initial_contact_last_hour: 0,
      },
    });

    await service.scheduleInitialContact({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      sponsorId: 'sponsor-1',
      assignmentId: 'assignment-1',
      now,
      random: () => 0.5,
    });

    expect(prisma.crmOutreachQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        intentType: CrmOutreachIntentType.initial_contact,
        status: CrmOutreachStatus.queued,
        payloadJson: expect.objectContaining({
          dispatch_enabled: false,
          template: expect.objectContaining({
            template_key: 'crm.initial_contact.safe_mlm.v1',
          }),
        }),
      }),
    });
  });

  it('crea blocked', async () => {
    const { prisma, policy, service } = buildService();
    policy.evaluateLeadEligibility = jest.fn().mockResolvedValue({
      eligible: false,
      reason: 'duplicate_requires_manual_review',
    });

    await service.scheduleInitialContact({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      sponsorId: 'sponsor-1',
      assignmentId: 'assignment-1',
      now,
    });

    expect(prisma.crmOutreachQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        intentType: CrmOutreachIntentType.initial_contact,
        status: 'blocked',
        scheduledAt: null,
        randomizedDelayMs: null,
        payloadJson: expect.objectContaining({
          blocked_reason: 'duplicate_requires_manual_review',
          dispatch_enabled: false,
          logical_status: 'blocked',
        }),
      }),
    });
  });

  it('genera jitter válido', async () => {
    const { prisma, policy, service } = buildService();
    policy.evaluateLeadEligibility = jest.fn().mockResolvedValue({
      eligible: true,
      reason: null,
      rate_limits: {
        initial_contact_last_15_min: 0,
        initial_contact_last_hour: 0,
      },
    });

    await service.scheduleInitialContact({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      sponsorId: 'sponsor-1',
      assignmentId: 'assignment-1',
      now,
      random: () => 0.25,
    });

    const createCall = (prisma.crmOutreachQueue.create as jest.Mock).mock
      .calls[0][0];
    const scheduledAt = createCall.data.scheduledAt as Date;
    const randomizedDelayMs = createCall.data.randomizedDelayMs as number;

    expect(randomizedDelayMs).toBeGreaterThanOrEqual(2 * 60 * 1000);
    expect(randomizedDelayMs).toBeLessThanOrEqual(12 * 60 * 1000);
    expect(scheduledAt.getTime()).toBe(now.getTime() + randomizedDelayMs);
  });
});
