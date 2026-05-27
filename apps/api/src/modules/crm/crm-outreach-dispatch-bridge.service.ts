import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CrmAssignmentStatus,
  CrmOutreachIntentType,
  CrmOutreachStatus,
  LeadStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { buildWhatsappRemoteJid } from './crm-kloser-mission.service';
import {
  CRM_EXTERNAL_DISPATCHER,
  type CrmExternalDispatcherPort,
  type CrmExternalOutreachHandoffPayload,
} from './crm-external-dispatcher.port';
import { CrmMessageTemplateService } from './crm-message-template.service';
import {
  CrmOutreachEligibilityResult,
  CrmOutreachPolicyService,
} from './crm-outreach-policy.service';

const DEFAULT_BATCH_LIMIT = 10;
const MAX_BATCH_LIMIT = 50;
const MAX_RETRY_COUNT = 4;
const RETRY_DELAYS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
];
const RECENT_OUTREACH_WINDOW_MS = 12 * 60 * 60 * 1000;

const ACTIVE_CRM_ASSIGNMENT_STATUSES = [
  CrmAssignmentStatus.pending_assignment,
  CrmAssignmentStatus.accepted,
  CrmAssignmentStatus.auto_accepted,
] as const;

const ACTIVE_OUTREACH_STATUSES = [
  CrmOutreachStatus.queued,
  CrmOutreachStatus.processing,
  CrmOutreachStatus.ready,
  CrmOutreachStatus.handed_off,
  CrmOutreachStatus.dispatched,
] as const;

type DispatchBridgeRecord = Prisma.CrmOutreachQueueGetPayload<{
  include: typeof dispatchBridgeInclude;
}>;

type StructuredFailureReason = {
  reason: string;
  category: 'mlm_policy' | 'dispatcher' | 'system';
  retryable: boolean;
  checked_at: string;
  details?: Record<string, unknown>;
};

@Injectable()
export class CrmOutreachDispatchBridgeService {
  private readonly logger = new Logger(CrmOutreachDispatchBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: CrmOutreachPolicyService,
    private readonly templates: CrmMessageTemplateService,
    @Inject(CRM_EXTERNAL_DISPATCHER)
    private readonly dispatcher: CrmExternalDispatcherPort,
  ) {}

  async handoffReadyOutreachBatch(input: {
    workspaceId: string;
    teamId: string;
    limit?: number;
    now?: Date;
    random?: () => number;
  }) {
    const now = input.now ?? new Date();
    const limit = normalizeBatchLimit(input.limit);
    const candidates = await this.prisma.crmOutreachQueue.findMany({
      where: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        status: {
          in: [CrmOutreachStatus.queued, CrmOutreachStatus.ready],
        },
        scheduledAt: {
          lte: now,
        },
        AND: [
          {
            OR: [
              {
                nextRetryAt: null,
              },
              {
                nextRetryAt: {
                  lte: now,
                },
              },
            ],
          },
        ],
      },
      include: dispatchBridgeInclude,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: limit * 3,
    });

    const summary = {
      scanned: candidates.length,
      claimed: 0,
      handed_off: 0,
      blocked: 0,
      failed: 0,
      retry_scheduled: 0,
      skipped: 0,
    };

    for (const candidate of candidates) {
      if (summary.claimed >= limit) {
        break;
      }

      if (!readDispatchEnabled(candidate.payloadJson)) {
        summary.skipped += 1;
        continue;
      }

      const claimed = await this.claimCandidate(candidate, now);

      if (!claimed) {
        summary.skipped += 1;
        continue;
      }

      summary.claimed += 1;
      const result = await this.handoffClaimedOutreach(
        claimed,
        now,
        input.random,
      );
      summary[result] += 1;
    }

    return summary;
  }

  private async claimCandidate(
    candidate: DispatchBridgeRecord,
    now: Date,
  ): Promise<DispatchBridgeRecord | null> {
    const claimed = await this.prisma.crmOutreachQueue.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
      },
      data: {
        status: CrmOutreachStatus.processing,
        lastAttemptAt: now,
      },
    });

    if (claimed.count !== 1) {
      return null;
    }

    return {
      ...candidate,
      status: CrmOutreachStatus.processing,
      lastAttemptAt: now,
    };
  }

  private async handoffClaimedOutreach(
    row: DispatchBridgeRecord,
    now: Date,
    random?: () => number,
  ): Promise<'handed_off' | 'blocked' | 'failed' | 'retry_scheduled'> {
    const validation = await this.validateDispatchSafety(row, now);

    if (!validation.allowed) {
      await this.blockOutreach(row, validation.reason, now);
      return 'blocked';
    }

    const rendered = this.templates.renderInitialContactTemplate({
      firstName: getFirstName(row.lead.fullName),
      advisorName: row.sponsor.displayName,
      locale: readTemplateLocale(readPayload(row.payloadJson)),
      random,
    });
    const payload = this.buildHandoffPayload(row, rendered.variant_index);

    try {
      const handoff = await this.dispatcher.handoffOutreach(payload);

      if (!handoff.accepted) {
        return this.handleDispatcherFailure(row, now, {
          reason: handoff.reason ?? 'dispatcher_rejected',
          category: 'dispatcher',
          retryable: true,
          checked_at: now.toISOString(),
          details: {
            accepted: false,
          },
        });
      }

      await this.prisma.crmOutreachQueue.update({
        where: {
          id: row.id,
        },
        data: {
          status: CrmOutreachStatus.handed_off,
          externalMissionId: handoff.external_id ?? null,
          externalHandoffStatus:
            handoff.reason === 'kloser_dry_run'
              ? 'dry_run'
              : handoff.reason === 'kloser_disabled_noop'
                ? 'disabled_noop'
                : CrmOutreachStatus.handed_off,
          lastHandoffAt: now,
          lastHandoffError: Prisma.JsonNull,
          nextRetryAt: null,
          failureReason: Prisma.JsonNull,
          payloadJson: toInputJsonValue({
            ...readPayload(row.payloadJson),
            handoff: {
              handed_off_at: now.toISOString(),
              external_id: handoff.external_id ?? null,
              dispatcher_reason: handoff.reason ?? null,
              campaign_variant_key: payload.campaign.variant_key,
            },
          }),
        },
      });
      await this.auditOutreachEvent(row, 'outreach_handed_off', {
        dispatcher_external_id: handoff.external_id ?? null,
        campaign_variant_key: payload.campaign.variant_key,
      });
      this.logOutreachEvent('outreach_handed_off', {
        outreach_id: row.id,
        lead_id: row.leadId,
        sponsor_id: row.sponsorId,
        team_id: row.teamId,
      });

      return 'handed_off';
    } catch (error) {
      return this.handleDispatcherFailure(row, now, {
        reason: 'dispatcher_error',
        category: 'dispatcher',
        retryable: true,
        checked_at: now.toISOString(),
        details: {
          error_name: error instanceof Error ? error.name : 'UnknownError',
        },
      });
    }
  }

  private async validateDispatchSafety(
    row: DispatchBridgeRecord,
    now: Date,
  ): Promise<
    | {
        allowed: true;
        eligibility: Extract<
          CrmOutreachEligibilityResult,
          { eligible: true }
        >;
      }
    | { allowed: false; reason: StructuredFailureReason }
  > {
    const payload = readPayload(row.payloadJson);
    const assignmentId = readString(payload.assignment_id);

    if (!assignmentId) {
      return {
        allowed: false,
        reason: buildFailureReason('assignment_missing', 'mlm_policy', false, now),
      };
    }

    if (!row.lead.phone) {
      return {
        allowed: false,
        reason: buildFailureReason('no_phone', 'mlm_policy', false, now),
      };
    }

    if (!buildWhatsappRemoteJid(row.lead.phone)) {
      return {
        allowed: false,
        reason: buildFailureReason('invalid_phone', 'mlm_policy', false, now),
      };
    }

    if (row.lead.status === LeadStatus.lost) {
      return {
        allowed: false,
        reason: buildFailureReason('lead_inactive', 'mlm_policy', false, now, {
          lead_status: row.lead.status,
        }),
      };
    }

    const assignment = await this.prisma.crmLeadAssignment.findFirst({
      where: {
        id: assignmentId,
        workspaceId: row.workspaceId,
        teamId: row.teamId,
        leadId: row.leadId,
        assignmentStatus: {
          in: [...ACTIVE_CRM_ASSIGNMENT_STATUSES],
        },
        OR: [
          {
            assignedSponsorId: row.sponsorId,
          },
          {
            acceptedBySponsorId: row.sponsorId,
          },
          {
            conversationOwnerSponsorId: row.sponsorId,
          },
          {
            attributedSponsorId: row.sponsorId,
          },
        ],
      },
      select: {
        id: true,
        assignedSponsorId: true,
        acceptedBySponsorId: true,
        conversationOwnerSponsorId: true,
        lastConversationAt: true,
        metadataJson: true,
      },
    });

    if (!assignment) {
      return {
        allowed: false,
        reason: buildFailureReason(
          'assignment_ownership_invalid',
          'mlm_policy',
          false,
          now,
          {
            assignment_id: assignmentId,
          },
        ),
      };
    }

    const duplicateActiveOutreach =
      await this.prisma.crmOutreachQueue.findFirst({
        where: {
          id: {
            not: row.id,
          },
          workspaceId: row.workspaceId,
          teamId: row.teamId,
          leadId: row.leadId,
          intentType: CrmOutreachIntentType.initial_contact,
          status: {
            in: [...ACTIVE_OUTREACH_STATUSES],
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

    if (duplicateActiveOutreach) {
      return {
        allowed: false,
        reason: buildFailureReason(
          'duplicate_active_outreach',
          'mlm_policy',
          false,
          now,
          {
            duplicate_outreach_id: duplicateActiveOutreach.id,
            duplicate_status: duplicateActiveOutreach.status,
          },
        ),
      };
    }

    const recentOutreach = await this.prisma.crmOutreachQueue.findFirst({
      where: {
        id: {
          not: row.id,
        },
        workspaceId: row.workspaceId,
        teamId: row.teamId,
        leadId: row.leadId,
        sponsorId: row.sponsorId,
        intentType: CrmOutreachIntentType.initial_contact,
        OR: [
          {
            lastAttemptAt: {
              gte: new Date(now.getTime() - RECENT_OUTREACH_WINDOW_MS),
            },
          },
          {
            createdAt: {
              gte: new Date(now.getTime() - RECENT_OUTREACH_WINDOW_MS),
            },
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
        lastAttemptAt: true,
      },
    });

    const assignmentMetadata = readPayload(assignment.metadataJson);
    const queueMetadata = readPayload(payload.metadata);
    const duplicateGroupKey =
      readString(queueMetadata.duplicate_group_key) ??
      readString(assignmentMetadata.duplicate_group_key);
    const possibleDuplicate =
      queueMetadata.possible_duplicate === true ||
      assignmentMetadata.possible_duplicate === true;
    const eligibility = await this.policy.evaluateLeadEligibility({
      workspaceId: row.workspaceId,
      teamId: row.teamId,
      leadId: row.leadId,
      sponsorId: row.sponsorId,
      conversation_started_at: assignment.lastConversationAt,
      conversation_owner_sponsor_id: assignment.conversationOwnerSponsorId,
      last_outreach_attempt_at:
        recentOutreach?.lastAttemptAt ?? recentOutreach?.createdAt ?? null,
      possible_duplicate: possibleDuplicate,
      duplicate_group_key: duplicateGroupKey,
      timezone: row.workspace.timezone ?? 'UTC',
      now,
    });

    if (!eligibility.eligible) {
      return {
        allowed: false,
        reason: buildFailureReason(eligibility.reason, 'mlm_policy', false, now, {
          quiet_hours_blocked: eligibility.quiet_hours_blocked,
          rate_limits: eligibility.rate_limits ?? null,
        }),
      };
    }

    return {
      allowed: true,
      eligibility,
    };
  }

  private buildHandoffPayload(
    row: DispatchBridgeRecord,
    variantIndex: number,
  ): CrmExternalOutreachHandoffPayload {
    const payload = readPayload(row.payloadJson);
    const assignmentId = readString(payload.assignment_id);

    if (!assignmentId) {
      throw new Error('CRM outreach handoff requires an assignment_id.');
    }

    return {
      outreach_id: row.id,
      assignment_id: assignmentId,
      workspace_id: row.workspaceId,
      team_id: row.teamId,
      sponsor_id: row.sponsorId,
      lead: {
        id: row.leadId,
        first_name: getFirstName(row.lead.fullName),
        phone_e164: row.lead.phone,
      },
      campaign: {
        type: 'initial_contact',
        variant_key: `crm.initial_contact.safe_mlm.v1:${variantIndex}`,
      },
      safety: {
        quiet_hours_checked: true,
        duplicate_protection: true,
        rate_limit_checked: true,
        mlm_policy_checked: true,
      },
      dispatch: {
        scheduled_for: row.scheduledAt?.toISOString() ?? null,
        priority: 'normal',
        jitter_ms: row.randomizedDelayMs,
      },
    };
  }

  private async blockOutreach(
    row: DispatchBridgeRecord,
    reason: StructuredFailureReason,
    now: Date,
  ) {
    await this.prisma.crmOutreachQueue.update({
      where: {
        id: row.id,
      },
      data: {
        status: CrmOutreachStatus.blocked,
        externalHandoffStatus: CrmOutreachStatus.blocked,
        nextRetryAt: null,
        failureReason: toInputJsonValue(reason),
        lastHandoffError: toInputJsonValue(reason),
        payloadJson: toInputJsonValue({
          ...readPayload(row.payloadJson),
          blocked_at: now.toISOString(),
          blocked_reason: reason.reason,
          logical_status: 'blocked',
        }),
      },
    });
    await this.auditOutreachEvent(row, 'outreach_blocked', {
      reason: reason.reason,
      category: reason.category,
    });
    this.logOutreachEvent('outreach_blocked', {
      outreach_id: row.id,
      lead_id: row.leadId,
      sponsor_id: row.sponsorId,
      team_id: row.teamId,
      reason: reason.reason,
    });
  }

  private async handleDispatcherFailure(
    row: DispatchBridgeRecord,
    now: Date,
    reason: StructuredFailureReason,
  ): Promise<'failed' | 'retry_scheduled'> {
    const nextRetryCount = row.retryCount + 1;

    if (nextRetryCount > MAX_RETRY_COUNT) {
      const finalFailureReason = {
        ...reason,
        retryable: false,
        details: {
          ...(reason.details ?? {}),
          max_retries_exceeded: true,
        },
      };

      await this.prisma.crmOutreachQueue.update({
        where: {
          id: row.id,
        },
        data: {
          status: CrmOutreachStatus.failed,
          externalHandoffStatus: CrmOutreachStatus.failed,
          retryCount: nextRetryCount,
          nextRetryAt: null,
          failureReason: toInputJsonValue(finalFailureReason),
          lastHandoffError: toInputJsonValue(finalFailureReason),
        },
      });
      await this.auditOutreachEvent(row, 'outreach_failed', {
        reason: reason.reason,
        retry_count: nextRetryCount,
      });

      return 'failed';
    }

    const nextRetryAt = new Date(
      now.getTime() + RETRY_DELAYS_MS[nextRetryCount - 1],
    );
    await this.prisma.crmOutreachQueue.update({
      where: {
        id: row.id,
      },
      data: {
        status: CrmOutreachStatus.queued,
        externalHandoffStatus: 'retry_scheduled',
        retryCount: nextRetryCount,
        nextRetryAt,
        failureReason: toInputJsonValue(reason),
        lastHandoffError: toInputJsonValue(reason),
      },
    });
    await this.auditOutreachEvent(row, 'outreach_retry_scheduled', {
      reason: reason.reason,
      retry_count: nextRetryCount,
      next_retry_at: nextRetryAt.toISOString(),
    });
    this.logOutreachEvent('outreach_retry_scheduled', {
      outreach_id: row.id,
      lead_id: row.leadId,
      sponsor_id: row.sponsorId,
      team_id: row.teamId,
      retry_count: nextRetryCount,
      next_retry_at: nextRetryAt.toISOString(),
    });

    return 'retry_scheduled';
  }

  private async auditOutreachEvent(
    row: DispatchBridgeRecord,
    eventName: string,
    payload: Record<string, unknown>,
  ) {
    const outreachPayload = readPayload(row.payloadJson);

    await this.prisma.domainEvent.create({
      data: {
        workspaceId: row.workspaceId,
        eventId: randomUUID(),
        aggregateType: 'lead',
        aggregateId: row.leadId,
        eventName,
        actorType: 'integration',
        payload: toInputJsonValue({
          outreach_id: row.id,
          crm_assignment_id: readString(outreachPayload.assignment_id),
          sponsor_id: row.sponsorId,
          status: row.status,
          ...payload,
        }),
        occurredAt: new Date(),
        leadId: row.leadId,
      },
    });
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

const dispatchBridgeInclude = {
  lead: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      status: true,
    },
  },
  sponsor: {
    select: {
      id: true,
      displayName: true,
    },
  },
  workspace: {
    select: {
      timezone: true,
    },
  },
} satisfies Prisma.CrmOutreachQueueInclude;

const normalizeBatchLimit = (value: number | undefined) => {
  const parsed = Number(value ?? DEFAULT_BATCH_LIMIT);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_BATCH_LIMIT;
  }

  return Math.min(MAX_BATCH_LIMIT, Math.max(1, Math.floor(parsed)));
};

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const buildFailureReason = (
  reason: string,
  category: StructuredFailureReason['category'],
  retryable: boolean,
  now: Date,
  details?: Record<string, unknown>,
): StructuredFailureReason => ({
  reason,
  category,
  retryable,
  checked_at: now.toISOString(),
  details,
});

const readPayload = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
};

const readDispatchEnabled = (value: Prisma.JsonValue | null) => {
  const payload = readPayload(value);

  return payload.dispatch_enabled === true;
};

const readTemplateLocale = (payload: Record<string, unknown>) => {
  const template = payload.template;

  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    return null;
  }

  return readString((template as Record<string, unknown>).locale);
};

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null;

const getFirstName = (fullName: string | null) => {
  const trimmed = fullName?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0] ?? null;
};
