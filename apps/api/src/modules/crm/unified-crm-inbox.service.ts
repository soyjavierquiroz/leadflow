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
    const fetchLimit = limit + 1;
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
    const ownerFilter = tab === 'unassigned' ? 'unassigned' : query.owner;
    const filters = {
      ...baseFilters,
      owner: ownerFilter ?? null,
    };
    const leadflowResult = includeLeadflow
      ? await this.resolveLeadflow(
          scope,
          filters,
          baseFilters,
          fetchLimit,
          query,
          cursor,
        )
      : {
          rows: [] as UnifiedCrmLead[],
          registeredCount: 0,
          unassignedCount: 0,
        };
    const supabaseResult = includeSupabase
      ? await this.resolveSupabase(
          scope,
          filters,
          fetchLimit,
          query,
          supabaseEnabled,
          cursor,
        )
      : {
          rows: [] as UnifiedCrmLead[],
          conversationalCount: 0,
          unassignedCount: 0,
          available: false,
          error: null,
        };
    const matchedRows = this.identityMatcher.markPossibleDuplicates([
      ...leadflowResult.rows,
      ...supabaseResult.rows,
    ]);
    const duplicateCount = matchedRows.filter(
      (row) => row.flags?.possible_duplicate,
    ).length;
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
        registrados: leadflowResult.registeredCount,
        conversacionales: supabaseResult.conversationalCount,
        todos:
          leadflowResult.registeredCount + supabaseResult.conversationalCount,
        posibles_duplicados: duplicateCount,
        sin_owner:
          leadflowResult.unassignedCount + supabaseResult.unassignedCount,
      },
      diagnostics: {
        leadflow_available: true,
        supabase_available: supabaseResult.available,
        supabase_enabled: supabaseEnabled,
        supabase_error: supabaseResult.error,
      },
    };
  }

  private async resolveLeadflow(
    scope: UnifiedCrmScope,
    filters: { q: string | null; status: string | null; owner: string | null },
    baseFilters: { q: string | null; status: string | null },
    limit: number,
    query: UnifiedCrmInboxQuery,
    cursor: UnifiedCrmPaginationCursor | null,
  ) {
    const [records, registeredCount, unassignedCount] = await Promise.all([
      this.leadflowRepository.findMany({
        scope,
        filters,
        limit,
        cursor,
      }),
      this.leadflowRepository.count({
        scope,
        filters: {
          ...baseFilters,
          owner: query.owner ?? null,
        },
      }),
      this.leadflowRepository.count({
        scope,
        filters: {
          ...baseFilters,
          owner: 'unassigned',
        },
      }),
    ]);

    return {
      rows: records.map((record) => this.mapper.fromLeadflow(record, scope)),
      registeredCount,
      unassignedCount,
    };
  }

  private async resolveSupabase(
    scope: UnifiedCrmScope,
    filters: { q: string | null; status: string | null; owner: string | null },
    limit: number,
    query: UnifiedCrmInboxQuery,
    supabaseEnabled: boolean,
    cursor: UnifiedCrmPaginationCursor | null,
  ) {
    if (!supabaseEnabled) {
      return {
        rows: [] as UnifiedCrmLead[],
        conversationalCount: 0,
        unassignedCount: 0,
        available: false,
        error: null,
      };
    }

    if (!this.kurukinClient.isConfigured()) {
      this.logger.warn(
        `Kurukin CRM read adapter is enabled but not configured. teamId=${scope.teamId}`,
      );

      return {
        rows: [] as UnifiedCrmLead[],
        conversationalCount: 0,
        unassignedCount: 0,
        available: false,
        error: 'missing_database_url',
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
      cursor,
    };
    const supabaseCountFilters = {
      tenantId: scope.teamId,
      q: filters.q,
      status: filters.status,
      owner: filters.owner,
      instanceId: query.instanceId ?? null,
      verticalKey: query.verticalKey ?? null,
    };

    try {
      const [records, conversationalCount, unassignedCount] = await Promise.all(
        [
          this.kurukinClient.listConversationalLeads(supabaseFilters),
          this.kurukinClient.countConversationalLeads(supabaseCountFilters),
          this.kurukinClient.countConversationalLeads({
            tenantId: scope.teamId,
            q: filters.q,
            status: filters.status,
            owner: 'unassigned',
            instanceId: query.instanceId ?? null,
            verticalKey: query.verticalKey ?? null,
          }),
        ],
      );

      return {
        rows: records.map((record) => this.mapper.fromSupabase(record)),
        conversationalCount,
        unassignedCount,
        available: true,
        error: null,
      };
    } catch (error) {
      const errorCode = this.toSupabaseDiagnosticsCode(error);
      this.logger.warn(
        `Kurukin CRM read failed. teamId=${scope.teamId} code=${errorCode}`,
      );

      return {
        rows: [] as UnifiedCrmLead[],
        conversationalCount: 0,
        unassignedCount: 0,
        available: false,
        error: errorCode,
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
