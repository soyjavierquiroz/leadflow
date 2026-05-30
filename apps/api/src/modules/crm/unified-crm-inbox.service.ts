import { Injectable, Logger } from '@nestjs/common';
import {
  KurukinCrmReadClient,
  KurukinCrmReadError,
} from './kurukin-crm-read.client';
import { CrmIdentityMatcher } from './crm-identity-matcher';
import { LeadflowCrmReadRepository } from './leadflow-crm-read.repository';
import { UnifiedCrmMapper } from './unified-crm.mapper';
import type {
  UnifiedCrmLead,
  UnifiedCrmInboxQuery,
  UnifiedCrmInboxResponse,
  UnifiedCrmInboxSource,
  UnifiedCrmInboxTab,
  UnifiedCrmPaginationCursor,
  UnifiedCrmScope,
} from './unified-crm.types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const INTERNAL_CANDIDATE_LIMIT = 1_000;
const validTabs = new Set<UnifiedCrmInboxTab>([
  'registered',
  'conversational',
  'all',
  'duplicates',
  'unassigned',
]);
const validSources = new Set<UnifiedCrmInboxSource>([
  'leadflow',
  'supabase',
  'all',
]);

const normalizeTab = (value: string | undefined): UnifiedCrmInboxTab =>
  value && validTabs.has(value as UnifiedCrmInboxTab)
    ? (value as UnifiedCrmInboxTab)
    : 'all';

const normalizeSource = (value: string | undefined): UnifiedCrmInboxSource =>
  value && validSources.has(value as UnifiedCrmInboxSource)
    ? (value as UnifiedCrmInboxSource)
    : 'all';

export const normalizeCrmLimit = (value: string | undefined) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
};

@Injectable()
export class UnifiedCrmInboxService {
  private readonly logger = new Logger(UnifiedCrmInboxService.name);

  constructor(
    private readonly leadflowRepository: LeadflowCrmReadRepository,
    private readonly mapper: UnifiedCrmMapper,
    private readonly kurukinClient: KurukinCrmReadClient,
    private readonly identityMatcher: CrmIdentityMatcher,
  ) {}

  async getInbox(
    scope: UnifiedCrmScope,
    query: UnifiedCrmInboxQuery = {},
  ): Promise<UnifiedCrmInboxResponse> {
    const tab = normalizeTab(query.tab);
    const source = normalizeSource(query.source);
    const limit = normalizeCrmLimit(query.limit);
    const cursor = decodeCrmCursor(query.cursor);
    const baseFilters = {
      q: query.q ?? null,
      status: query.status ?? null,
    };
    const supabaseEnabled = this.kurukinClient.isEnabled();
    const supabaseCanProvideContext =
      supabaseEnabled && this.kurukinClient.isConfigured();

    const includeLeadflow =
      source !== 'supabase' &&
      (tab === 'registered' ||
        tab === 'all' ||
        tab === 'duplicates' ||
        tab === 'unassigned' ||
        (tab === 'conversational' && supabaseCanProvideContext));
    const includeSupabase =
      source === 'supabase' ||
      (source !== 'leadflow' &&
        (tab === 'conversational' ||
          tab === 'all' ||
          tab === 'duplicates' ||
          tab === 'unassigned' ||
          (tab === 'registered' && supabaseCanProvideContext)));
    const filters = {
      ...baseFilters,
      owner: query.owner ?? null,
    };
    const leadflowResult = includeLeadflow
      ? await this.resolveLeadflow(
          scope,
          filters,
          INTERNAL_CANDIDATE_LIMIT,
        )
      : {
          rows: [] as UnifiedCrmLead[],
          candidateLimitReached: false,
        };
    const supabaseResult = includeSupabase
      ? await this.resolveSupabase(
          scope,
          filters,
          INTERNAL_CANDIDATE_LIMIT,
          query,
          supabaseEnabled,
        )
      : {
          rows: [] as UnifiedCrmLead[],
          available: false,
          error: null,
          candidateLimitReached: false,
        };
    const matchedRows = this.identityMatcher.markPossibleDuplicates([
      ...leadflowResult.rows,
      ...supabaseResult.rows,
    ]);
    const counts = buildCounts(matchedRows);
    const requestedRows = matchedRows
      .filter((row) => matchesRequestedView(row, tab, source))
      .filter((row) => !cursor || isAfterCursor(row, cursor))
      .sort(compareCrmRows);
    const data = requestedRows.slice(0, limit);
    const nextCursor =
      requestedRows.length > limit
        ? encodeCrmCursor(data[data.length - 1])
        : null;

    return {
      data,
      page: {
        limit,
        cursor: query.cursor ?? null,
        next_cursor: nextCursor,
      },
      counts: {
        registrados: counts.registered,
        conversacionales: counts.conversational,
        todos: counts.all,
        posibles_duplicados: counts.duplicates,
        sin_owner: counts.unassigned,
      },
      diagnostics: {
        leadflow_available: true,
        supabase_available: supabaseResult.available,
        supabase_enabled: supabaseEnabled,
        supabase_error: supabaseResult.error,
        crm_candidate_limit_reached:
          leadflowResult.candidateLimitReached ||
          supabaseResult.candidateLimitReached ||
          undefined,
      },
    };
  }

  private async resolveLeadflow(
    scope: UnifiedCrmScope,
    filters: { q: string | null; status: string | null; owner: string | null },
    limit: number,
  ) {
    const records = await this.leadflowRepository.findMany({
      scope,
      filters,
      limit,
      cursor: null,
    });
    return {
      rows: records.map((record) => this.mapper.fromLeadflow(record, scope)),
      candidateLimitReached: records.length >= limit,
    };
  }

  private async resolveSupabase(
    scope: UnifiedCrmScope,
    filters: { q: string | null; status: string | null; owner: string | null },
    limit: number,
    query: UnifiedCrmInboxQuery,
    supabaseEnabled: boolean,
  ) {
    if (!supabaseEnabled) {
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

    const supabaseFilters = {
      tenantId: scope.teamId,
      limit,
      q: filters.q,
      status: filters.status,
      owner: filters.owner,
      instanceId: query.instanceId ?? null,
      verticalKey: query.verticalKey ?? null,
      cursor: null,
    };

    try {
      const records = await this.kurukinClient.listConversationalLeads(
        supabaseFilters,
      );

      return {
        rows: records.map((record) => this.mapper.fromSupabase(record)),
        available: true,
        error: null,
        candidateLimitReached: records.length >= limit,
      };
    } catch (error) {
      const errorCode = this.toSupabaseDiagnosticsCode(error);
      this.logger.warn(
        `Kurukin CRM read failed. teamId=${scope.teamId} code=${errorCode}`,
      );

      return {
        rows: [] as UnifiedCrmLead[],
        available: false,
        error: errorCode,
        candidateLimitReached: false,
      };
    }
  }

  private toSupabaseDiagnosticsCode(error: unknown) {
    if (error instanceof KurukinCrmReadError) {
      return error.code;
    }

    return 'query_failed';
  }
}

const buildCounts = (rows: UnifiedCrmLead[]) => {
  return rows.reduce(
    (counts, row) => {
      if (row.source === 'leadflow') {
        counts.registered += 1;
      }

      if (row.source === 'supabase') {
        counts.conversational += 1;
      }

      if (row.flags?.possible_duplicate) {
        counts.duplicates += 1;
      }

      if (row.flags?.is_orphaned) {
        counts.unassigned += 1;
      }

      counts.all += 1;
      return counts;
    },
    {
      all: 0,
      conversational: 0,
      duplicates: 0,
      registered: 0,
      unassigned: 0,
    },
  );
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

const compareCrmRows = (left: UnifiedCrmLead, right: UnifiedCrmLead) => {
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

const encodeCrmCursor = (row: UnifiedCrmLead | undefined) => {
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

const decodeCrmCursor = (
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

const matchesRequestedView = (
  row: UnifiedCrmLead,
  tab: UnifiedCrmInboxTab,
  source: UnifiedCrmInboxSource,
) => {
  if (source !== 'all' && row.source !== source) {
    return false;
  }

  if (tab === 'registered') {
    return row.source === 'leadflow';
  }

  if (tab === 'conversational') {
    return row.source === 'supabase';
  }

  if (tab === 'duplicates') {
    return Boolean(row.flags?.possible_duplicate);
  }

  if (tab === 'unassigned') {
    return Boolean(row.flags?.is_orphaned);
  }

  return true;
};
