import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CrmOutreachStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmMessageTemplateService } from './crm-message-template.service';
import { isQuietHoursBlocked } from './crm-outreach-policy.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const LISTED_STATUSES: CrmOutreachStatus[] = [
  CrmOutreachStatus.queued,
  CrmOutreachStatus.processing,
  CrmOutreachStatus.ready,
  CrmOutreachStatus.handed_off,
  CrmOutreachStatus.blocked,
  CrmOutreachStatus.failed,
  CrmOutreachStatus.cancelled,
  CrmOutreachStatus.dispatched,
  CrmOutreachStatus.completed,
];

export type CrmOutreachQueueQuery = {
  status?: string;
  sponsor_id?: string;
  q?: string;
  cursor?: string;
  limit?: string | number;
};

type QueueCursor = {
  created_at: string;
  id: string;
};

type OutreachQueueRecord = Prisma.CrmOutreachQueueGetPayload<{
  include: {
    lead: {
      select: {
        id: true;
        fullName: true;
        phone: true;
        sourceChannel: true;
      };
    };
    sponsor: {
      select: {
        id: true;
        displayName: true;
      };
    };
    workspace: {
      select: {
        timezone: true;
      };
    };
  };
}>;

@Injectable()
export class CrmOutreachQueueService {
  private readonly logger = new Logger(CrmOutreachQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: CrmMessageTemplateService,
  ) {}

  async listOutreachQueue(
    scope: { workspaceId: string; teamId: string },
    query: CrmOutreachQueueQuery = {},
  ) {
    const limit = normalizeLimit(query.limit);
    const status = normalizeStatusFilter(query.status);
    const cursor = decodeCursor(query.cursor);
    const baseWhere = this.buildWhere(scope, query, null);
    const where = this.buildWhere(scope, query, status);
    const cursorWhere = cursor ? buildCursorWhere(cursor) : null;
    const rows = await this.prisma.crmOutreachQueue.findMany({
      where: cursorWhere
        ? {
            AND: [where, cursorWhere],
          }
        : where,
      include: queueInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const visibleRows = rows.slice(0, limit);
    const counts = await this.buildCounts(baseWhere);

    return {
      items: visibleRows.map((row) => this.toListItem(row)),
      counts,
      page: {
        next_cursor:
          rows.length > limit
            ? encodeCursor(visibleRows[visibleRows.length - 1])
            : null,
      },
    };
  }

  async dryRunOutreach(
    scope: { workspaceId: string; teamId: string },
    queueId: string,
    now = new Date(),
  ) {
    const row = await this.findScopedQueueRow(scope, queueId);
    const preview = this.buildPreview(row, now);

    this.logOutreachEvent('crm_outreach_dry_run', {
      queue_id: row.id,
      lead_id: row.leadId,
      sponsor_id: row.sponsorId,
      team_id: row.teamId,
      allowed_to_dispatch: preview.allowed_to_dispatch,
      blocked_reason: preview.blocked_reason,
    });

    return preview;
  }

  async getDispatchMetrics(
    scope: { workspaceId: string; teamId: string },
    now = new Date(),
  ) {
    const baseWhere = {
      workspaceId: scope.workspaceId,
      teamId: scope.teamId,
    };
    const [
      queued,
      ready,
      handedOff,
      blocked,
      failed,
      retriesPending,
      quietHoursBlocked,
      rateLimited,
    ] = await Promise.all([
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: CrmOutreachStatus.queued,
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: CrmOutreachStatus.ready,
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: CrmOutreachStatus.handed_off,
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: CrmOutreachStatus.blocked,
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: CrmOutreachStatus.failed,
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: {
            in: [CrmOutreachStatus.queued, CrmOutreachStatus.ready],
          },
          nextRetryAt: {
            gt: now,
          },
        },
      }),
      this.countBlockedByReason(baseWhere, 'quiet_hours_blocked'),
      this.countBlockedByReason(baseWhere, 'sponsor_rate_limited'),
    ]);

    return {
      queued,
      ready,
      handed_off: handedOff,
      blocked,
      failed,
      retries_pending: retriesPending,
      quiet_hours_blocked: quietHoursBlocked,
      rate_limited: rateLimited,
    };
  }

  async requeueOutreach(
    scope: { workspaceId: string; teamId: string },
    queueId: string,
    now = new Date(),
  ) {
    const row = await this.findScopedQueueRow(scope, queueId);

    if (
      row.status !== CrmOutreachStatus.failed &&
      row.status !== CrmOutreachStatus.blocked
    ) {
      throw new BadRequestException({
        code: 'CRM_OUTREACH_REQUEUE_STATUS_INVALID',
        message: 'Only failed or blocked outreach can be requeued.',
      });
    }

    const updated = await this.prisma.crmOutreachQueue.update({
      where: {
        id: row.id,
      },
      data: {
        status: CrmOutreachStatus.queued,
        scheduledAt: now,
        retryCount: 0,
        lastAttemptAt: null,
        nextRetryAt: null,
        failureReason: Prisma.JsonNull,
        externalMissionId: null,
        externalHandoffStatus: null,
        lastHandoffAt: null,
        lastHandoffError: Prisma.JsonNull,
        payloadJson: toInputJsonValue({
          ...readPayload(row.payloadJson),
          requeued_at: now.toISOString(),
          requeue_source: 'team_admin',
        }),
      },
    });

    this.logOutreachEvent('crm_outreach_requeued', {
      queue_id: row.id,
      lead_id: row.leadId,
      sponsor_id: row.sponsorId,
      team_id: row.teamId,
    });

    return {
      id: updated.id,
      status: updated.status,
      retry_count: updated.retryCount,
      next_retry_at: toIso(updated.nextRetryAt),
    };
  }

  async claimNextDispatchableOutreach(input: {
    workspaceId: string;
    teamId: string;
    sponsorId?: string | null;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const candidate = await this.prisma.crmOutreachQueue.findFirst({
      where: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        sponsorId: input.sponsorId ?? undefined,
        status: CrmOutreachStatus.queued,
        OR: [
          {
            scheduledAt: null,
          },
          {
            scheduledAt: {
              lte: now,
            },
          },
        ],
      },
      include: queueInclude,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    if (!candidate || !readDispatchEnabled(candidate.payloadJson)) {
      return null;
    }

    const preview = this.buildPreview(candidate, now);

    if (!preview.allowed_to_dispatch) {
      return null;
    }

    const claimed = await this.prisma.crmOutreachQueue.updateMany({
      where: {
        id: candidate.id,
        status: CrmOutreachStatus.queued,
      },
      data: {
        status: CrmOutreachStatus.processing,
      },
    });

    if (claimed.count !== 1) {
      return null;
    }

    this.logOutreachEvent('crm_outreach_claimed', {
      queue_id: candidate.id,
      lead_id: candidate.leadId,
      sponsor_id: candidate.sponsorId,
      team_id: candidate.teamId,
    });

    return {
      ...preview,
      status: CrmOutreachStatus.processing,
    };
  }

  private buildWhere(
    scope: { workspaceId: string; teamId: string },
    query: CrmOutreachQueueQuery,
    status: CrmOutreachStatus | null,
  ): Prisma.CrmOutreachQueueWhereInput {
    const q = query.q?.trim();

    return {
      workspaceId: scope.workspaceId,
      teamId: scope.teamId,
      status: status ?? {
        in: LISTED_STATUSES,
      },
      sponsorId: query.sponsor_id?.trim() || undefined,
      OR: q
        ? [
            {
              lead: {
                fullName: {
                  contains: q,
                  mode: 'insensitive',
                },
              },
            },
            {
              lead: {
                phone: {
                  contains: q,
                  mode: 'insensitive',
                },
              },
            },
            {
              sponsor: {
                displayName: {
                  contains: q,
                  mode: 'insensitive',
                },
              },
            },
          ]
        : undefined,
    };
  }

  private async buildCounts(baseWhere: Prisma.CrmOutreachQueueWhereInput) {
    const [queued, blocked, dispatched, cancelled] = await Promise.all([
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: CrmOutreachStatus.queued,
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: CrmOutreachStatus.blocked,
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: {
            in: [CrmOutreachStatus.dispatched, CrmOutreachStatus.completed],
          },
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: CrmOutreachStatus.cancelled,
        },
      }),
    ]);

    return {
      queued,
      blocked,
      dispatched,
      cancelled,
    };
  }

  private async countBlockedByReason(
    baseWhere: Prisma.CrmOutreachQueueWhereInput,
    reason: string,
  ) {
    return this.prisma.crmOutreachQueue.count({
      where: {
        ...baseWhere,
        status: {
          in: [CrmOutreachStatus.blocked, CrmOutreachStatus.failed],
        },
        OR: [
          {
            failureReason: {
              path: ['reason'],
              equals: reason,
            },
          },
          {
            payloadJson: {
              path: ['blocked_reason'],
              equals: reason,
            },
          },
        ],
      },
    });
  }

  private async findScopedQueueRow(
    scope: { workspaceId: string; teamId: string },
    queueId: string,
  ) {
    const row = await this.prisma.crmOutreachQueue.findFirst({
      where: {
        id: queueId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      include: queueInclude,
    });

    if (!row) {
      throw new NotFoundException({
        code: 'CRM_OUTREACH_QUEUE_NOT_FOUND',
        message: 'The outreach queue item was not found.',
      });
    }

    return row;
  }

  private toListItem(row: OutreachQueueRecord) {
    const metadata = readPayload(row.payloadJson);
    const blockedReason = readBlockedReason(row);

    return {
      id: row.id,
      lead_id: row.leadId,
      assignment_id: readString(metadata.assignment_id),
      sponsor_id: row.sponsorId,
      sponsor_name: row.sponsor.displayName,
      status: toPublicStatus(row),
      blocked_reason: blockedReason,
      scheduled_for: toIso(row.scheduledAt),
      created_at: toIso(row.createdAt),
      dispatch_enabled: readDispatchEnabled(row.payloadJson),
      risk_flags: {
        duplicate_detected:
          blockedReason === 'duplicate_requires_manual_review',
        rate_limited: blockedReason === 'sponsor_rate_limited',
        protected_window: blockedReason === 'quiet_hours_blocked',
        no_phone: !row.lead.phone,
      },
      lead: {
        id: row.lead.id,
        full_name: row.lead.fullName,
        phone_e164: row.lead.phone,
        source: row.lead.sourceChannel,
      },
    };
  }

  private buildPreview(row: OutreachQueueRecord, now: Date) {
    const metadata = readPayload(row.payloadJson);
    const blockedReason =
      readBlockedReason(row) ?? (!row.lead.phone ? 'no_phone' : null);
    const rendered = this.templates.renderInitialContactTemplate({
      firstName: getFirstName(row.lead.fullName),
      advisorName: row.sponsor.displayName,
      locale: readTemplateLocale(metadata),
    });
    const quietHoursBlocked = isQuietHoursBlocked(
      now,
      row.workspace.timezone ?? 'UTC',
    );
    const safety = {
      within_rate_limit: blockedReason !== 'sponsor_rate_limited',
      duplicate_protection:
        blockedReason !== 'duplicate_requires_manual_review',
      quiet_hours_ok: !quietHoursBlocked,
      protected_window_ok:
        !quietHoursBlocked && blockedReason !== 'quiet_hours_blocked',
    };
    const allowedToDispatch =
      row.status === CrmOutreachStatus.queued &&
      !blockedReason &&
      Object.values(safety).every(Boolean);

    return {
      queue_id: row.id,
      lead_id: row.leadId,
      sponsor_id: row.sponsorId,
      allowed_to_dispatch: allowedToDispatch,
      blocked_reason: blockedReason,
      payload: {
        template_key: rendered.template_key,
        variables: rendered.variables,
        rendered_preview: rendered.rendered_preview,
      },
      safety,
    };
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

const queueInclude = {
  lead: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      sourceChannel: true,
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

const normalizeLimit = (value: string | number | undefined) => {
  const parsed = Number(value ?? DEFAULT_LIMIT);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
};

const normalizeStatusFilter = (value: string | undefined) => {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const mapped =
    normalized === 'dispatched' ? CrmOutreachStatus.dispatched : normalized;

  if (!LISTED_STATUSES.includes(mapped as CrmOutreachStatus)) {
    throw new BadRequestException({
      code: 'CRM_OUTREACH_STATUS_INVALID',
      message: 'The outreach queue status filter is invalid.',
    });
  }

  return mapped as CrmOutreachStatus;
};

const buildCursorWhere = (
  cursor: QueueCursor,
): Prisma.CrmOutreachQueueWhereInput => {
  const createdAt = new Date(cursor.created_at);

  return {
    OR: [
      {
        createdAt: {
          lt: createdAt,
        },
      },
      {
        createdAt,
        id: {
          gt: cursor.id,
        },
      },
    ],
  };
};

const encodeCursor = (row: OutreachQueueRecord | undefined) => {
  if (!row) {
    return null;
  }

  return Buffer.from(
    JSON.stringify({
      created_at: row.createdAt.toISOString(),
      id: row.id,
    }),
  ).toString('base64url');
};

const decodeCursor = (value: string | undefined): QueueCursor | null => {
  if (!value) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<QueueCursor>;

    if (!decoded.created_at || !decoded.id) {
      return null;
    }

    return {
      created_at: decoded.created_at,
      id: decoded.id,
    };
  } catch {
    throw new BadRequestException({
      code: 'CRM_OUTREACH_CURSOR_INVALID',
      message: 'The outreach queue cursor is invalid.',
    });
  }
};

const readPayload = (value: Prisma.JsonValue | null) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
};

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null;

const readBlockedReason = (row: {
  status: CrmOutreachStatus;
  payloadJson: Prisma.JsonValue | null;
}) => {
  const payload = readPayload(row.payloadJson);
  const blockedReason = readString(payload.blocked_reason);

  if (blockedReason) {
    return blockedReason;
  }

  if (
    row.status === CrmOutreachStatus.cancelled &&
    readString(payload.requested_status) === 'blocked'
  ) {
    return readString(payload.blocked_reason) ?? 'blocked';
  }

  return null;
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

const toPublicStatus = (row: {
  status: CrmOutreachStatus;
  payloadJson: Prisma.JsonValue | null;
}) => {
  const payload = readPayload(row.payloadJson);

  if (
    row.status === CrmOutreachStatus.blocked ||
    readString(payload.logical_status) === 'blocked' ||
    readString(payload.requested_status) === 'blocked'
  ) {
    return 'blocked';
  }

  if (
    row.status === CrmOutreachStatus.dispatched ||
    row.status === CrmOutreachStatus.completed
  ) {
    return 'dispatched';
  }

  return row.status;
};

const toIso = (value: Date | null) => value?.toISOString() ?? null;

const getFirstName = (fullName: string | null) => {
  const trimmed = fullName?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0] ?? null;
};
