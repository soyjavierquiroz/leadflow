import { Injectable } from '@nestjs/common';
import { CrmOutreachIntentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const MAX_INITIAL_OUTREACH_PER_15_MIN = 5;
export const MAX_INITIAL_OUTREACH_PER_HOUR = 20;

const RECENT_OUTREACH_WINDOW_MS = 12 * 60 * 60 * 1000;

export type CrmOutreachBlockReason =
  | 'conversation_already_started'
  | 'conversation_owned_by_other_sponsor'
  | 'recent_outreach_attempt'
  | 'sponsor_rate_limited'
  | 'duplicate_requires_manual_review'
  | 'quiet_hours_blocked'
  | 'assignment_missing'
  | 'assignment_ownership_invalid'
  | 'duplicate_active_outreach'
  | 'lead_inactive'
  | 'no_phone';

export type CrmOutreachEligibilityResult =
  | {
      eligible: true;
      reason: null;
      rate_limits: {
        initial_contact_last_15_min: number;
        initial_contact_last_hour: number;
      };
      quiet_hours_blocked: boolean;
    }
  | {
      eligible: false;
      reason: CrmOutreachBlockReason;
      rate_limits?: {
        initial_contact_last_15_min: number;
        initial_contact_last_hour: number;
      };
      quiet_hours_blocked: boolean;
    };

type OutreachPolicyClient = Pick<PrismaService, '$queryRaw'>;

const toDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

@Injectable()
export class CrmOutreachPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateLeadEligibility(input: {
    workspaceId: string;
    teamId: string;
    leadId: string;
    sponsorId: string;
    conversation_started_at?: Date | string | null;
    conversation_owner_sponsor_id?: string | null;
    last_outreach_attempt_at?: Date | string | null;
    possible_duplicate?: boolean | null;
    duplicate_group_key?: string | null;
    timezone?: string | null;
    now?: Date;
    tx?: OutreachPolicyClient;
  }): Promise<CrmOutreachEligibilityResult> {
    const now = input.now ?? new Date();
    const lastOutreachAttemptAt = toDate(input.last_outreach_attempt_at);
    const quietHoursBlocked = isQuietHoursBlocked(now, input.timezone ?? 'UTC');

    if (input.conversation_started_at) {
      return {
        eligible: false,
        reason: 'conversation_already_started',
        quiet_hours_blocked: quietHoursBlocked,
      };
    }

    if (
      input.conversation_owner_sponsor_id &&
      input.conversation_owner_sponsor_id !== input.sponsorId
    ) {
      return {
        eligible: false,
        reason: 'conversation_owned_by_other_sponsor',
        quiet_hours_blocked: quietHoursBlocked,
      };
    }

    if (
      lastOutreachAttemptAt &&
      now.getTime() - lastOutreachAttemptAt.getTime() <
        RECENT_OUTREACH_WINDOW_MS
    ) {
      return {
        eligible: false,
        reason: 'recent_outreach_attempt',
        quiet_hours_blocked: quietHoursBlocked,
      };
    }

    if (input.possible_duplicate && input.duplicate_group_key) {
      return {
        eligible: false,
        reason: 'duplicate_requires_manual_review',
        quiet_hours_blocked: quietHoursBlocked,
      };
    }

    if (quietHoursBlocked) {
      return {
        eligible: false,
        reason: 'quiet_hours_blocked',
        quiet_hours_blocked: true,
      };
    }

    const client = input.tx ?? this.prisma;
    const [last15MinCount, lastHourCount] = await Promise.all([
      this.countSponsorInitialOutreach({
        client,
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        sponsorId: input.sponsorId,
        since: new Date(now.getTime() - 15 * 60 * 1000),
      }),
      this.countSponsorInitialOutreach({
        client,
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        sponsorId: input.sponsorId,
        since: new Date(now.getTime() - 60 * 60 * 1000),
      }),
    ]);

    const rateLimits = {
      initial_contact_last_15_min: last15MinCount,
      initial_contact_last_hour: lastHourCount,
    };

    if (
      last15MinCount >= MAX_INITIAL_OUTREACH_PER_15_MIN ||
      lastHourCount >= MAX_INITIAL_OUTREACH_PER_HOUR
    ) {
      return {
        eligible: false,
        reason: 'sponsor_rate_limited',
        rate_limits: rateLimits,
        quiet_hours_blocked: false,
      };
    }

    return {
      eligible: true,
      reason: null,
      rate_limits: rateLimits,
      quiet_hours_blocked: false,
    };
  }

  private async countSponsorInitialOutreach(input: {
    client: OutreachPolicyClient;
    workspaceId: string;
    teamId: string;
    sponsorId: string;
    since: Date;
  }) {
    const rows = await input.client.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM crm_outreach_queue
        WHERE workspace_id = ${input.workspaceId}
          AND team_id = ${input.teamId}
          AND sponsor_id = ${input.sponsorId}
          AND intent_type::text = ${CrmOutreachIntentType.initial_contact}
          AND status::text IN ('queued', 'ready', 'processing', 'handed_off', 'dispatched')
          AND created_at >= ${input.since}
      `,
    );

    return Number(rows[0]?.count ?? 0);
  }
}

export const isQuietHoursBlocked = (date: Date, timezone: string) => {
  const hour = getLocalHour(date, timezone);

  return hour >= 22 || hour < 8;
};

const getLocalHour = (date: Date, timezone: string) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).formatToParts(date);
    const hourPart = parts.find((part) => part.type === 'hour')?.value;
    const hour = Number(hourPart);

    return Number.isFinite(hour) ? hour % 24 : date.getUTCHours();
  } catch {
    return date.getUTCHours();
  }
};
