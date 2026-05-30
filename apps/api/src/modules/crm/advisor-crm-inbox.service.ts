import { Injectable, Logger } from '@nestjs/common';
import {
  AssignmentStatus,
  CrmAssignmentStatus,
  CrmOutreachStatus,
  LeadStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CrmIdentityMatcher,
  normalizePhone,
  normalizeWhatsappId,
} from './crm-identity-matcher';
import {
  KurukinCrmReadClient,
  KurukinCrmReadError,
} from './kurukin-crm-read.client';
import { UnifiedCrmMapper } from './unified-crm.mapper';
import type { LeadflowCrmLeadRecord } from './leadflow-crm-read.repository';
import type {
  UnifiedCrmLead,
  UnifiedCrmPaginationCursor,
} from './unified-crm.types';
import type {
  AdvisorCrmInboxQuery,
  AdvisorCrmInboxResponse,
  AdvisorCrmInboxTab,
  AdvisorCrmLead,
  AdvisorCrmSponsorSummary,
  AdvisorCrmScope,
} from './advisor-crm.types';
import { CrmOwnershipPolicyService } from './crm-ownership-policy.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const INTERNAL_CANDIDATE_LIMIT = 1_000;
const EXTERNAL_CANDIDATE_LIMIT = 1_000;
const handoffAssignmentStatuses: AssignmentStatus[] = [
  AssignmentStatus.pending,
  AssignmentStatus.assigned,
];
const activeAssignmentStatuses: AssignmentStatus[] = [
  AssignmentStatus.accepted,
];
const crmHandoffAssignmentStatuses: CrmAssignmentStatus[] = [
  CrmAssignmentStatus.pending_assignment,
];
const crmActiveAssignmentStatuses: CrmAssignmentStatus[] = [
  CrmAssignmentStatus.accepted,
  CrmAssignmentStatus.auto_accepted,
];
const crmAdvisorVisibleAssignmentStatuses: CrmAssignmentStatus[] = [
  ...crmHandoffAssignmentStatuses,
  ...crmActiveAssignmentStatuses,
  CrmAssignmentStatus.reassigned,
  CrmAssignmentStatus.closed,
];
const visibleOutreachStatuses: CrmOutreachStatus[] = [
  CrmOutreachStatus.queued,
  CrmOutreachStatus.scheduled,
  CrmOutreachStatus.processing,
];
const advisorVisibleAssignmentStatuses: AssignmentStatus[] = [
  ...handoffAssignmentStatuses,
  ...activeAssignmentStatuses,
];
const leadStatuses = new Set<string>(Object.values(LeadStatus));
const assignmentStatuses = new Set<string>(Object.values(AssignmentStatus));
const crmAssignmentStatuses = new Set<string>(
  Object.values(CrmAssignmentStatus),
);
const validTabs = new Set<AdvisorCrmInboxTab>([
  'all',
  'handoffs',
  'active',
  'duplicates',
  'external_matches',
]);

const advisorLeadflowInclude = (sponsorId: string, teamId: string) =>
  ({
    currentAssignment: {
      include: {
        sponsor: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            status: true,
          },
        },
      },
    },
    assignments: {
      where: {
        sponsorId,
        teamId,
        status: {
          in: advisorVisibleAssignmentStatuses,
        },
      },
      include: {
        sponsor: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            status: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { assignedAt: 'desc' }],
      take: 1,
    },
    crmLeadAssignments: {
      where: {
        teamId,
        assignmentStatus: {
          in: crmAdvisorVisibleAssignmentStatuses,
        },
        OR: [
          {
            attributedSponsorId: sponsorId,
          },
          {
            assignedSponsorId: sponsorId,
          },
          {
            acceptedBySponsorId: sponsorId,
          },
          {
            conversationOwnerSponsorId: sponsorId,
          },
        ],
      },
      include: {
        attributedSponsor: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            status: true,
          },
        },
        assignedSponsor: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            status: true,
          },
        },
        acceptedBySponsor: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            status: true,
          },
        },
        conversationOwnerSponsor: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            status: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { assignedAt: 'desc' }],
      take: 1,
    },
    crmOutreachQueue: {
      where: {
        teamId,
        sponsorId,
        status: {
          in: visibleOutreachStatuses,
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 1,
    },
    funnelInstance: {
      select: {
        name: true,
      },
    },
    funnelPublication: {
      select: {
        pathPrefix: true,
        domain: {
          select: {
            host: true,
          },
        },
      },
    },
  }) satisfies Prisma.LeadInclude;

type AdvisorLeadflowRecord = Prisma.LeadGetPayload<{
  include: ReturnType<typeof advisorLeadflowInclude>;
}>;

@Injectable()
export class AdvisorCrmInboxService {
  private readonly logger = new Logger(AdvisorCrmInboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: UnifiedCrmMapper,
    private readonly kurukinClient: KurukinCrmReadClient,
    private readonly identityMatcher: CrmIdentityMatcher,
    private readonly ownershipPolicy: CrmOwnershipPolicyService,
  ) {}

  async getInbox(
    scope: AdvisorCrmScope,
    query: AdvisorCrmInboxQuery = {},
  ): Promise<AdvisorCrmInboxResponse> {
    const tab = normalizeTab(query.tab);
    const limit = normalizeAdvisorCrmLimit(query.limit);
    const cursor = decodeAdvisorCrmCursor(query.cursor);
    const records = await this.loadAssignedLeadflowRecords(scope, query);
    const leadflowRows = records.map((record) =>
      this.mapper.fromLeadflow(
        record as unknown as LeadflowCrmLeadRecord,
        scope,
      ),
    );
    const leadIdentities = collectLeadIdentities(leadflowRows);
    const supabaseEnabled = this.kurukinClient.isEnabled();
    const supabaseResult = await this.loadSupabaseMatches(
      scope,
      query,
      leadIdentities,
      supabaseEnabled,
    );
    const externalRows = supabaseResult.rows.filter((row) =>
      rowMatchesIdentities(row, leadIdentities),
    );
    const matchedRows = this.identityMatcher.markPossibleDuplicates([
      ...leadflowRows,
      ...externalRows,
    ]);
    const matchedById = new Map(matchedRows.map((row) => [row.id, row]));
    const externalByIdentity = groupExternalRowsByIdentity(externalRows);
    const advisorRows = records
      .map((record) => {
        const baseRow = matchedById.get(`leadflow:${record.id}`);
        return baseRow
          ? this.toAdvisorLead(baseRow, record, scope, externalByIdentity)
          : null;
      })
      .filter((row): row is AdvisorCrmLead => Boolean(row));
    const searchedRows = advisorRows.filter((row) =>
      matchesAdvisorSearch(row, query.q),
    );
    const counts = buildCounts(searchedRows);
    const visibleRows = searchedRows
      .filter((row) => matchesRequestedAdvisorView(row, tab))
      .sort(compareAdvisorCrmRows);
    const cursorRows = visibleRows.filter(
      (row) => !cursor || isAfterCursor(row, cursor),
    );
    const data = cursorRows.slice(0, limit);
    const nextCursor =
      cursorRows.length > limit
        ? encodeAdvisorCrmCursor(data[data.length - 1])
        : null;

    return {
      data,
      page: {
        limit,
        cursor: query.cursor ?? null,
        next_cursor: nextCursor,
      },
      counts: {
        ...counts,
        total_visible: visibleRows.length,
      },
      diagnostics: {
        leadflow_available: true,
        supabase_available: supabaseResult.available,
        supabase_enabled: supabaseEnabled,
        supabase_error: supabaseResult.error,
        crm_candidate_limit_reached:
          records.length >= INTERNAL_CANDIDATE_LIMIT ||
          supabaseResult.candidateLimitReached ||
          undefined,
      },
    };
  }

  private async loadAssignedLeadflowRecords(
    scope: AdvisorCrmScope,
    query: AdvisorCrmInboxQuery,
  ) {
    const where = buildAdvisorLeadWhere(scope, query);

    return this.prisma.lead.findMany({
      where,
      include: advisorLeadflowInclude(scope.sponsorId, scope.teamId),
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: INTERNAL_CANDIDATE_LIMIT,
    });
  }

  private async loadSupabaseMatches(
    scope: AdvisorCrmScope,
    query: AdvisorCrmInboxQuery,
    identities: Set<string>,
    supabaseEnabled: boolean,
  ) {
    if (!supabaseEnabled || identities.size === 0) {
      return {
        rows: [] as UnifiedCrmLead[],
        available: false,
        error: null,
        candidateLimitReached: false,
      };
    }

    if (!this.kurukinClient.isConfigured()) {
      this.logger.warn(
        `Kurukin CRM read adapter is enabled but not configured. teamId=${scope.teamId}`,
      );

      return {
        rows: [] as UnifiedCrmLead[],
        available: false,
        error: 'missing_database_url',
        candidateLimitReached: false,
      };
    }

    try {
      const records = await this.kurukinClient.listConversationalLeadsByPhones({
        tenantId: scope.teamId,
        phones: [...identities],
        limit: EXTERNAL_CANDIDATE_LIMIT,
      });

      return {
        rows: records.map((record) => this.mapper.fromSupabase(record)),
        available: true,
        error: null,
        candidateLimitReached: records.length >= EXTERNAL_CANDIDATE_LIMIT,
      };
    } catch (error) {
      const errorCode = this.toSupabaseDiagnosticsCode(error);
      this.logger.warn(
        `Kurukin CRM advisor read failed. teamId=${scope.teamId} sponsorId=${scope.sponsorId} code=${errorCode}`,
      );

      return {
        rows: [] as UnifiedCrmLead[],
        available: false,
        error: errorCode,
        candidateLimitReached: false,
      };
    }
  }

  private toAdvisorLead(
    row: UnifiedCrmLead,
    record: AdvisorLeadflowRecord,
    scope: AdvisorCrmScope,
    externalByIdentity: Map<string, UnifiedCrmLead[]>,
  ): AdvisorCrmLead {
    const assignment = record.assignments[0] ?? null;
    const crmAssignment = record.crmLeadAssignments[0] ?? null;
    const outreach = record.crmOutreachQueue[0] ?? null;
    const resolvedOwner = this.ownershipPolicy.resolveOwner({
      conversationOwnerSponsorId:
        crmAssignment?.conversationOwnerSponsorId ?? null,
      acceptedBySponsorId: crmAssignment?.acceptedBySponsorId ?? null,
      assignedSponsorId: crmAssignment?.assignedSponsorId ?? null,
      attributedSponsorId: crmAssignment?.attributedSponsorId ?? null,
    });
    const ownerSponsor =
      (resolvedOwner.source === 'conversation_owner'
        ? crmAssignment?.conversationOwnerSponsor
        : resolvedOwner.source === 'accepted_assignment'
          ? crmAssignment?.acceptedBySponsor
          : resolvedOwner.source === 'assigned_sponsor'
            ? crmAssignment?.assignedSponsor
            : resolvedOwner.source === 'attribution'
              ? crmAssignment?.attributedSponsor
              : null) ?? null;
    const externalMatches = getExternalMatchesForLead(row, externalByIdentity);
    const latestExternal = pickLatestExternal(externalMatches);
    const latestExternalAt = latestExternal?.activity?.last_activity_at ?? null;
    const latestExternalTimestamp = toTimestamp(latestExternalAt);
    const leadTimestamp = getActivityTimestamp(row);
    const shouldPromoteExternalActivity =
      latestExternal && latestExternalTimestamp > leadTimestamp;

    return {
      ...row,
      source: 'leadflow',
      owner: crmAssignment
        ? {
            ...row.owner,
            sponsor_id: resolvedOwner.sponsorId,
            display_name: ownerSponsor?.displayName ?? row.owner?.display_name,
            phone: ownerSponsor?.phone ?? row.owner?.phone,
            status: ownerSponsor?.status ?? row.owner?.status,
            assignment_status: crmAssignment.assignmentStatus,
            assigned_at: toIso(crmAssignment.assignedAt),
            accepted_at: toIso(crmAssignment.acceptedAt),
          }
        : row.owner,
      activity: shouldPromoteExternalActivity
        ? {
            ...row.activity,
            last_activity_at: latestExternalAt,
            last_message:
              latestExternal.activity?.last_message ??
              row.activity?.last_message ??
              null,
          }
        : row.activity,
      advisor_context: {
        assignment_id: crmAssignment?.id ?? assignment?.id ?? null,
        legacy_assignment_id: assignment?.id ?? null,
        crm_assignment_id: crmAssignment?.id ?? null,
        assignment_status:
          crmAssignment?.assignmentStatus ?? assignment?.status ?? null,
        assignment_source: crmAssignment?.assignmentSource ?? null,
        assigned_at: toIso(crmAssignment?.assignedAt ?? assignment?.assignedAt),
        accepted_at: toIso(crmAssignment?.acceptedAt ?? assignment?.acceptedAt),
        ownership_locked_until: toIso(crmAssignment?.ownershipLockedUntil),
        is_current_sponsor_owner:
          resolvedOwner.sponsorId === scope.sponsorId ||
          (!crmAssignment && row.owner?.sponsor_id === scope.sponsorId) ||
          assignment?.status === AssignmentStatus.accepted,
        ownership_source: crmAssignment ? resolvedOwner.source : undefined,
        conversation_owner: toSponsorSummary(
          crmAssignment?.conversationOwnerSponsor,
        ),
        assigned_sponsor: toSponsorSummary(crmAssignment?.assignedSponsor),
        attributed_sponsor: toSponsorSummary(crmAssignment?.attributedSponsor),
        accepted_by_sponsor: toSponsorSummary(crmAssignment?.acceptedBySponsor),
        outreach: outreach
          ? {
              has_initial_contact_queued: true,
              status: outreach.status,
              intent_type: outreach.intentType,
              created_at: toIso(outreach.createdAt),
              scheduled_at: toIso(outreach.scheduledAt),
            }
          : {
              has_initial_contact_queued: false,
              status: null,
              intent_type: null,
              created_at: null,
              scheduled_at: null,
            },
        has_external_conversation: externalMatches.length > 0,
        external_conversation_count: externalMatches.length,
        latest_external_message:
          latestExternal?.activity?.last_message ??
          latestExternal?.supabase?.last_message ??
          null,
        latest_external_message_at: latestExternalAt,
      },
    };
  }

  private toSupabaseDiagnosticsCode(error: unknown) {
    if (error instanceof KurukinCrmReadError) {
      return error.code;
    }

    return 'query_failed';
  }
}

const buildAdvisorLeadWhere = (
  scope: AdvisorCrmScope,
  query: AdvisorCrmInboxQuery,
): Prisma.LeadWhereInput => {
  const status = query.status?.trim();
  const assignmentStatus = query.assignment_status?.trim();
  const andFilters: Prisma.LeadWhereInput[] = [
    {
      OR: [
        {
          assignments: {
            some: {
              workspaceId: scope.workspaceId,
              teamId: scope.teamId,
              sponsorId: scope.sponsorId,
              status: {
                in: advisorVisibleAssignmentStatuses,
              },
            },
          },
        },
        {
          crmLeadAssignments: {
            some: {
              workspaceId: scope.workspaceId,
              teamId: scope.teamId,
              assignmentStatus: {
                in: crmAdvisorVisibleAssignmentStatuses,
              },
              OR: [
                {
                  attributedSponsorId: scope.sponsorId,
                },
                {
                  assignedSponsorId: scope.sponsorId,
                },
                {
                  acceptedBySponsorId: scope.sponsorId,
                },
                {
                  conversationOwnerSponsorId: scope.sponsorId,
                },
              ],
            },
          },
        },
      ],
    },
  ];

  if (status) {
    andFilters.push(
      leadStatuses.has(status)
        ? { status: status as LeadStatus }
        : { id: '__advisor_crm_invalid_status__' },
    );
  }

  if (assignmentStatus) {
    const statusFilters: Prisma.LeadWhereInput[] = [];

    if (assignmentStatuses.has(assignmentStatus)) {
      statusFilters.push({
        assignments: {
          some: {
            workspaceId: scope.workspaceId,
            teamId: scope.teamId,
            sponsorId: scope.sponsorId,
            status: assignmentStatus as AssignmentStatus,
          },
        },
      });
    }

    if (crmAssignmentStatuses.has(assignmentStatus)) {
      statusFilters.push({
        crmLeadAssignments: {
          some: {
            workspaceId: scope.workspaceId,
            teamId: scope.teamId,
            assignmentStatus: assignmentStatus as CrmAssignmentStatus,
            OR: [
              {
                attributedSponsorId: scope.sponsorId,
              },
              {
                assignedSponsorId: scope.sponsorId,
              },
              {
                acceptedBySponsorId: scope.sponsorId,
              },
              {
                conversationOwnerSponsorId: scope.sponsorId,
              },
            ],
          },
        },
      });
    }

    andFilters.push(
      statusFilters.length > 0
        ? {
            OR: statusFilters,
          }
        : { id: '__advisor_crm_invalid_assignment_status__' },
    );
  }

  return {
    workspaceId: scope.workspaceId,
    AND: andFilters,
  };
};

export const normalizeAdvisorCrmLimit = (value: string | undefined) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
};

const normalizeTab = (value: string | undefined): AdvisorCrmInboxTab =>
  value && validTabs.has(value as AdvisorCrmInboxTab)
    ? (value as AdvisorCrmInboxTab)
    : 'all';

const toIso = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getActivityTimestamp = (row: UnifiedCrmLead) =>
  toTimestamp(row.activity?.last_activity_at) ||
  toTimestamp(row.updated_at) ||
  toTimestamp(row.created_at);

const getActivityIso = (row: UnifiedCrmLead) => {
  const timestamp = getActivityTimestamp(row);
  return timestamp > 0 ? new Date(timestamp).toISOString() : null;
};

const compareAdvisorCrmRows = (left: UnifiedCrmLead, right: UnifiedCrmLead) => {
  const activityDiff = getActivityTimestamp(right) - getActivityTimestamp(left);

  if (activityDiff !== 0) {
    return activityDiff;
  }

  return left.id.localeCompare(right.id);
};

const isAfterCursor = (
  row: UnifiedCrmLead,
  cursor: UnifiedCrmPaginationCursor,
) => {
  const cursorTimestamp = toTimestamp(cursor.last_activity_at);
  const rowTimestamp = getActivityTimestamp(row);

  if (rowTimestamp !== cursorTimestamp) {
    return rowTimestamp < cursorTimestamp;
  }

  return row.id > cursor.id;
};

const encodeAdvisorCrmCursor = (row: UnifiedCrmLead | undefined) => {
  if (!row) {
    return null;
  }

  return Buffer.from(
    JSON.stringify({
      last_activity_at: getActivityIso(row),
      id: row.id,
    } satisfies UnifiedCrmPaginationCursor),
    'utf8',
  ).toString('base64url');
};

const decodeAdvisorCrmCursor = (
  value: string | null | undefined,
): UnifiedCrmPaginationCursor | null => {
  if (!value) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as unknown;

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('id' in payload) ||
      typeof payload.id !== 'string'
    ) {
      return null;
    }

    const lastActivityAt =
      'last_activity_at' in payload &&
      typeof payload.last_activity_at === 'string'
        ? payload.last_activity_at
        : null;

    return {
      id: payload.id,
      last_activity_at: lastActivityAt,
    };
  } catch {
    return null;
  }
};

const collectLeadIdentities = (rows: UnifiedCrmLead[]) => {
  const identities = new Set<string>();

  for (const row of rows) {
    const phone = normalizePhone(row.contact?.phone_e164);
    const whatsapp = normalizeWhatsappId(row.contact?.whatsapp_id);

    if (phone) {
      identities.add(phone);
    }

    if (whatsapp) {
      identities.add(whatsapp);
    }
  }

  return identities;
};

const rowMatchesIdentities = (row: UnifiedCrmLead, identities: Set<string>) => {
  const phone = normalizePhone(row.contact?.phone_e164);
  const whatsapp = normalizeWhatsappId(row.contact?.whatsapp_id);

  return Boolean(
    (phone && identities.has(phone)) || (whatsapp && identities.has(whatsapp)),
  );
};

const groupExternalRowsByIdentity = (rows: UnifiedCrmLead[]) => {
  const grouped = new Map<string, UnifiedCrmLead[]>();

  for (const row of rows) {
    for (const identity of [
      normalizePhone(row.contact?.phone_e164),
      normalizeWhatsappId(row.contact?.whatsapp_id),
    ]) {
      if (!identity) {
        continue;
      }

      const current = grouped.get(identity) ?? [];
      current.push(row);
      grouped.set(identity, current);
    }
  }

  return grouped;
};

const getExternalMatchesForLead = (
  row: UnifiedCrmLead,
  externalByIdentity: Map<string, UnifiedCrmLead[]>,
) => {
  const identities = [
    normalizePhone(row.contact?.phone_e164),
    normalizeWhatsappId(row.contact?.whatsapp_id),
  ].filter((identity): identity is string => Boolean(identity));
  const matches = identities.flatMap(
    (identity) => externalByIdentity.get(identity) ?? [],
  );

  return [...new Map(matches.map((match) => [match.id, match])).values()];
};

const pickLatestExternal = (rows: UnifiedCrmLead[]) =>
  [...rows].sort(compareAdvisorCrmRows)[0] ?? null;

const isHandoff = (row: AdvisorCrmLead) =>
  handoffAssignmentStatuses.includes(
    row.advisor_context.assignment_status as AssignmentStatus,
  ) ||
  crmHandoffAssignmentStatuses.includes(
    row.advisor_context.assignment_status as CrmAssignmentStatus,
  );

const isActive = (row: AdvisorCrmLead) =>
  activeAssignmentStatuses.includes(
    row.advisor_context.assignment_status as AssignmentStatus,
  ) ||
  crmActiveAssignmentStatuses.includes(
    row.advisor_context.assignment_status as CrmAssignmentStatus,
  ) ||
  row.leadflow?.status === LeadStatus.nurturing ||
  row.leadflow?.status === LeadStatus.qualified;

const toSponsorSummary = (
  sponsor:
    | {
        id: string;
        displayName: string;
        phone: string | null;
        status: string;
      }
    | null
    | undefined,
): AdvisorCrmSponsorSummary | null =>
  sponsor
    ? {
        id: sponsor.id,
        display_name: sponsor.displayName,
        phone: sponsor.phone,
        status: sponsor.status,
      }
    : null;

const matchesAdvisorSearch = (
  row: AdvisorCrmLead,
  value: string | null | undefined,
) => {
  const query = value?.trim().toLowerCase();

  if (!query) {
    return true;
  }

  const searchableValues = [
    row.contact?.display_name,
    row.contact?.phone_e164,
    row.contact?.whatsapp_id,
    row.contact?.email,
    row.contact?.company_name,
    row.leadflow?.status,
    row.owner?.display_name,
    row.activity?.last_message,
    row.advisor_context.latest_external_message,
  ];

  return searchableValues.some((candidate) =>
    candidate?.toLowerCase().includes(query),
  );
};

const matchesRequestedAdvisorView = (
  row: AdvisorCrmLead,
  tab: AdvisorCrmInboxTab,
) => {
  if (tab === 'handoffs') {
    return isHandoff(row);
  }

  if (tab === 'active') {
    return isActive(row);
  }

  if (tab === 'duplicates') {
    return Boolean(row.flags?.possible_duplicate);
  }

  if (tab === 'external_matches') {
    return row.advisor_context.has_external_conversation;
  }

  return true;
};

const buildCounts = (rows: AdvisorCrmLead[]) =>
  rows.reduce(
    (counts, row) => {
      counts.todos += 1;

      if (isHandoff(row)) {
        counts.handoffs += 1;
      }

      if (isActive(row)) {
        counts.activos += 1;
      }

      if (row.flags?.possible_duplicate) {
        counts.duplicados += 1;
      }

      if (row.advisor_context.has_external_conversation) {
        counts.external_matches += 1;
      } else {
        counts.sin_conversacion += 1;
      }

      return counts;
    },
    {
      todos: 0,
      handoffs: 0,
      activos: 0,
      duplicados: 0,
      external_matches: 0,
      sin_conversacion: 0,
    },
  );
