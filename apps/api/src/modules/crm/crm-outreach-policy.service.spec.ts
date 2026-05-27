import { CrmOutreachPolicyService } from './crm-outreach-policy.service';
import type { PrismaService } from '../../prisma/prisma.service';

const now = new Date('2026-05-26T12:00:00.000Z');

const buildService = () => {
  const prisma = {
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;

  return {
    prisma,
    service: new CrmOutreachPolicyService(prisma),
  };
};

describe('CrmOutreachPolicyService', () => {
  it('bloquea conversación activa', async () => {
    const { prisma, service } = buildService();

    const result = await service.evaluateLeadEligibility({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      sponsorId: 'sponsor-1',
      conversation_started_at: now,
      now,
    });

    expect(result).toEqual({
      eligible: false,
      reason: 'conversation_already_started',
      quiet_hours_blocked: false,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('bloquea sponsor rate limit', async () => {
    const { prisma, service } = buildService();
    prisma.$queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ count: BigInt(5) }])
      .mockResolvedValueOnce([{ count: BigInt(10) }]);

    const result = await service.evaluateLeadEligibility({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      sponsorId: 'sponsor-1',
      now,
    });

    expect(result).toEqual({
      eligible: false,
      reason: 'sponsor_rate_limited',
      rate_limits: {
        initial_contact_last_15_min: 5,
        initial_contact_last_hour: 10,
      },
      quiet_hours_blocked: false,
    });
  });

  it('bloquea duplicate protegido', async () => {
    const { prisma, service } = buildService();

    const result = await service.evaluateLeadEligibility({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      sponsorId: 'sponsor-1',
      possible_duplicate: true,
      duplicate_group_key: 'phone:workspace-1:59170000000',
      now,
    });

    expect(result).toEqual({
      eligible: false,
      reason: 'duplicate_requires_manual_review',
      quiet_hours_blocked: false,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('permite lead limpio', async () => {
    const { prisma, service } = buildService();
    prisma.$queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ count: BigInt(1) }])
      .mockResolvedValueOnce([{ count: BigInt(4) }]);

    const result = await service.evaluateLeadEligibility({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      sponsorId: 'sponsor-1',
      now,
    });

    expect(result).toEqual({
      eligible: true,
      reason: null,
      rate_limits: {
        initial_contact_last_15_min: 1,
        initial_contact_last_hour: 4,
      },
      quiet_hours_blocked: false,
    });
  });

  it('bloquea dentro de quiet hours locales', async () => {
    const { prisma, service } = buildService();

    const result = await service.evaluateLeadEligibility({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      sponsorId: 'sponsor-1',
      timezone: 'America/La_Paz',
      now: new Date('2026-05-26T03:00:00.000Z'),
    });

    expect(result).toEqual({
      eligible: false,
      reason: 'quiet_hours_blocked',
      quiet_hours_blocked: true,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('permite fuera de quiet hours locales', async () => {
    const { prisma, service } = buildService();
    prisma.$queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);

    const result = await service.evaluateLeadEligibility({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      leadId: 'lead-1',
      sponsorId: 'sponsor-1',
      timezone: 'America/La_Paz',
      now: new Date('2026-05-26T14:00:00.000Z'),
    });

    expect(result).toEqual({
      eligible: true,
      reason: null,
      rate_limits: {
        initial_contact_last_15_min: 0,
        initial_contact_last_hour: 0,
      },
      quiet_hours_blocked: false,
    });
  });
});
