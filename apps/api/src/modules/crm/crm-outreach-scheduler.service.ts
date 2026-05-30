import { Injectable, Logger } from '@nestjs/common';
import {
  CrmOutreachIntentType,
  CrmOutreachStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmMessageTemplateService } from './crm-message-template.service';
import {
  CrmOutreachEligibilityResult,
  CrmOutreachPolicyService,
} from './crm-outreach-policy.service';

const MIN_INITIAL_CONTACT_DELAY_MS = 2 * 60 * 1000;
const MAX_INITIAL_CONTACT_DELAY_MS = 12 * 60 * 1000;
const CRM_OUTREACH_BLOCKED_STATUS = CrmOutreachStatus.blocked;

type OutreachSchedulerClient = Prisma.TransactionClient | PrismaService;
type WorkspaceTimezoneReader = {
  workspace?: {
    findUnique: (args: {
      where: { id: string };
      select: { timezone: true };
    }) => Promise<{ timezone: string } | null>;
  };
};

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const readMetadata = (value: Prisma.JsonValue | null) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const isUnsupportedBlockedStatusError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('blocked') &&
    (message.includes('crmoutreachstatus') || message.includes('enum'))
  );
};

@Injectable()
export class CrmOutreachSchedulerService {
  private readonly logger = new Logger(CrmOutreachSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: CrmOutreachPolicyService,
    private readonly templates: CrmMessageTemplateService,
  ) {}

  async scheduleInitialContact(input: {
    workspaceId: string;
    teamId: string;
    leadId: string;
    sponsorId: string;
    assignmentId: string;
    conversationStartedAt?: Date | string | null;
    conversationOwnerSponsorId?: string | null;
    lastOutreachAttemptAt?: Date | string | null;
    possibleDuplicate?: boolean | null;
    duplicateGroupKey?: string | null;
    timezone?: string | null;
    locale?: string | null;
    metadata?: Record<string, unknown>;
    now?: Date;
    random?: () => number;
    tx?: OutreachSchedulerClient;
  }) {
    const now = input.now ?? new Date();
    const client = input.tx ?? this.prisma;
    const timezone =
      input.timezone ??
      (await this.resolveWorkspaceTimezone(client, input.workspaceId));
    const lastOutreachAttemptAt =
      input.lastOutreachAttemptAt ??
      (await this.findLastOutreachAttemptAt(client, input));
    const eligibility = await this.policy.evaluateLeadEligibility({
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      leadId: input.leadId,
      sponsorId: input.sponsorId,
      conversation_started_at: input.conversationStartedAt ?? null,
      conversation_owner_sponsor_id: input.conversationOwnerSponsorId ?? null,
      last_outreach_attempt_at: lastOutreachAttemptAt,
      possible_duplicate: input.possibleDuplicate ?? false,
      duplicate_group_key: input.duplicateGroupKey ?? null,
      timezone,
      now,
      tx: client,
    });

    if (!eligibility.eligible) {
      return this.createBlockedQueueRow(client, input, eligibility, now);
    }

    const randomizedDelayMs = this.randomDelayMs(input.random);
    const scheduledAt = new Date(now.getTime() + randomizedDelayMs);

    const row = await client.crmOutreachQueue.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        leadId: input.leadId,
        sponsorId: input.sponsorId,
        intentType: CrmOutreachIntentType.initial_contact,
        status: CrmOutreachStatus.queued,
        scheduledAt,
        randomizedDelayMs,
        payloadJson: toInputJsonValue({
          assignment_id: input.assignmentId,
          safe_mode: true,
          dispatch_enabled: false,
          template: this.templates.buildInitialContactTemplate({
            leadId: input.leadId,
            sponsorId: input.sponsorId,
            locale: input.locale,
          }),
          eligibility,
          pacing_policy: {
            random_delays: true,
            humanized_delays: true,
            sponsor_rate_limits: true,
            quiet_hours: '22:00-08:00',
            timezone,
            min_delay_ms: MIN_INITIAL_CONTACT_DELAY_MS,
            max_delay_ms: MAX_INITIAL_CONTACT_DELAY_MS,
          },
          metadata: input.metadata ?? {},
        }),
      },
    });
    this.logOutreachEvent('crm_outreach_queued', {
      queue_id: row.id,
      lead_id: input.leadId,
      sponsor_id: input.sponsorId,
      team_id: input.teamId,
      scheduled_at: scheduledAt.toISOString(),
      dispatch_enabled: false,
    });

    return row;
  }

  private async createBlockedQueueRow(
    client: OutreachSchedulerClient,
    input: {
      workspaceId: string;
      teamId: string;
      leadId: string;
      sponsorId: string;
      assignmentId: string;
      metadata?: Record<string, unknown>;
    },
    eligibility: Extract<CrmOutreachEligibilityResult, { eligible: false }>,
    now: Date,
  ) {
    const data = {
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      leadId: input.leadId,
      sponsorId: input.sponsorId,
      intentType: CrmOutreachIntentType.initial_contact,
      status: CRM_OUTREACH_BLOCKED_STATUS,
      scheduledAt: null,
      randomizedDelayMs: null,
      payloadJson: toInputJsonValue({
        assignment_id: input.assignmentId,
        blocked_at: now.toISOString(),
        blocked_reason: eligibility.reason,
        logical_status: 'blocked',
        safe_mode: true,
        dispatch_enabled: false,
        eligibility,
        metadata: input.metadata ?? {},
      }),
    };

    try {
      const row = await client.crmOutreachQueue.create({
        data,
      });
      this.logOutreachEvent('crm_outreach_blocked', {
        queue_id: row.id,
        lead_id: input.leadId,
        sponsor_id: input.sponsorId,
        team_id: input.teamId,
        blocked_reason: eligibility.reason,
      });

      return row;
    } catch (error) {
      if (!isUnsupportedBlockedStatusError(error)) {
        throw error;
      }

      const row = await client.crmOutreachQueue.create({
        data: {
          ...data,
          status: CrmOutreachStatus.cancelled,
          payloadJson: toInputJsonValue({
            ...(readMetadata(data.payloadJson as Prisma.JsonValue) ?? {}),
            requested_status: 'blocked',
          }),
        },
      });
      this.logOutreachEvent('crm_outreach_blocked', {
        queue_id: row.id,
        lead_id: input.leadId,
        sponsor_id: input.sponsorId,
        team_id: input.teamId,
        blocked_reason: eligibility.reason,
        fallback_status: CrmOutreachStatus.cancelled,
      });

      return row;
    }
  }

  private randomDelayMs(random = Math.random) {
    const spreadMs =
      MAX_INITIAL_CONTACT_DELAY_MS - MIN_INITIAL_CONTACT_DELAY_MS;
    return MIN_INITIAL_CONTACT_DELAY_MS + Math.floor(random() * spreadMs);
  }

  private async findLastOutreachAttemptAt(
    client: OutreachSchedulerClient,
    input: {
      workspaceId: string;
      teamId: string;
      leadId: string;
      sponsorId: string;
    },
  ) {
    const lastAttempt = await client.crmOutreachQueue.findFirst({
      where: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        leadId: input.leadId,
        sponsorId: input.sponsorId,
        intentType: CrmOutreachIntentType.initial_contact,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    return lastAttempt?.createdAt ?? null;
  }

  private async resolveWorkspaceTimezone(
    client: OutreachSchedulerClient,
    workspaceId: string,
  ) {
    const workspaceReader = client as unknown as WorkspaceTimezoneReader;
    const workspace = await workspaceReader.workspace?.findUnique({
      where: {
        id: workspaceId,
      },
      select: {
        timezone: true,
      },
    });

    return workspace?.timezone ?? 'UTC';
  }

  private logOutreachEvent(event: string, payload: Record<string, unknown>) {
    this.logger.log(
      JSON.stringify({
        event,
        ...payload,
      }),
    );
  }
}
