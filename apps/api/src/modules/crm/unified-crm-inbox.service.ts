import { Injectable, Logger } from '@nestjs/common';
import {
  KurukinCrmReadClient,
  KurukinCrmReadError,
} from './kurukin-crm-read.client';
import { LeadflowCrmReadRepository } from './leadflow-crm-read.repository';
import { UnifiedCrmMapper } from './unified-crm.mapper';
import type {
  UnifiedCrmLead,
  UnifiedCrmInboxQuery,
  UnifiedCrmInboxResponse,
  UnifiedCrmInboxSource,
  UnifiedCrmInboxTab,
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
  ) {}

  async getInbox(
    scope: UnifiedCrmScope,
    query: UnifiedCrmInboxQuery = {},
  ): Promise<UnifiedCrmInboxResponse> {
    const tab = normalizeTab(query.tab);
    const source = normalizeSource(query.source);
    const limit = normalizeCrmLimit(query.limit);
    const baseFilters = {
      q: query.q ?? null,
      status: query.status ?? null,
    };
    const supabaseEnabled = this.kurukinClient.isEnabled();

    if (tab === 'duplicates') {
      return this.emptyResponse({
        limit,
        cursor: query.cursor ?? null,
        supabaseEnabled,
        supabaseError: null,
      });
    }

    const includeLeadflow =
      source !== 'supabase' &&
      (tab === 'registered' || tab === 'all' || tab === 'unassigned');
    const includeSupabase =
      source === 'supabase' ||
      (source !== 'leadflow' &&
        (tab === 'conversational' || tab === 'all' || tab === 'unassigned'));
    const ownerFilter = tab === 'unassigned' ? 'unassigned' : query.owner;
    const filters = {
      ...baseFilters,
      owner: ownerFilter ?? null,
    };
    const leadflowResult = includeLeadflow
      ? await this.resolveLeadflow(scope, filters, baseFilters, limit, query)
      : {
          rows: [] as UnifiedCrmLead[],
          registeredCount: 0,
          unassignedCount: 0,
        };
    const supabaseResult = includeSupabase
      ? await this.resolveSupabase(scope, filters, limit, query, supabaseEnabled)
      : {
          rows: [] as UnifiedCrmLead[],
          conversationalCount: 0,
          unassignedCount: 0,
          available: false,
          error: null,
        };
    const data = [...leadflowResult.rows, ...supabaseResult.rows]
      .sort((left, right) =>
        byLastActivityDesc(left.activity.last_activity_at, right.activity.last_activity_at),
      )
      .slice(0, limit);

    return {
      data,
      page: {
        limit,
        cursor: query.cursor ?? null,
        next_cursor: null,
      },
      counts: {
        registrados: leadflowResult.registeredCount,
        conversacionales: supabaseResult.conversationalCount,
        todos:
          leadflowResult.registeredCount + supabaseResult.conversationalCount,
        posibles_duplicados: 0,
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
  ) {
    const [records, registeredCount, unassignedCount] = await Promise.all([
      this.leadflowRepository.findMany({
        scope,
        filters,
        limit,
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
      const [records, conversationalCount, unassignedCount] = await Promise.all([
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
      ]);

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

  private emptyResponse(input: {
    limit: number;
    cursor: string | null;
    supabaseEnabled: boolean;
    supabaseError: string | null;
  }): UnifiedCrmInboxResponse {
    return {
      data: [],
      page: {
        limit: input.limit,
        cursor: input.cursor,
        next_cursor: null,
      },
      counts: {
        registrados: 0,
        conversacionales: 0,
        todos: 0,
        posibles_duplicados: 0,
        sin_owner: 0,
      },
      diagnostics: {
        leadflow_available: true,
        supabase_available: false,
        supabase_enabled: input.supabaseEnabled,
        supabase_error: input.supabaseError,
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

const byLastActivityDesc = (
  left: string | null | undefined,
  right: string | null | undefined,
) => {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;

  return rightTime - leftTime;
};
