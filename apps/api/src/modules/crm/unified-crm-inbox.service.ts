import { Injectable } from '@nestjs/common';
import { LeadflowCrmReadRepository } from './leadflow-crm-read.repository';
import { UnifiedCrmMapper } from './unified-crm.mapper';
import type {
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
  constructor(
    private readonly leadflowRepository: LeadflowCrmReadRepository,
    private readonly mapper: UnifiedCrmMapper,
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

    if (
      source === 'supabase' ||
      tab === 'conversational' ||
      tab === 'duplicates'
    ) {
      return this.emptyResponse(limit, query.cursor ?? null);
    }

    const ownerFilter = tab === 'unassigned' ? 'unassigned' : query.owner;
    const filters = {
      ...baseFilters,
      owner: ownerFilter ?? null,
    };
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
      data: records.map((record) => this.mapper.fromLeadflow(record, scope)),
      page: {
        limit,
        cursor: query.cursor ?? null,
        next_cursor: null,
      },
      counts: {
        registrados: registeredCount,
        conversacionales: 0,
        todos: registeredCount,
        posibles_duplicados: 0,
        sin_owner: unassignedCount,
      },
      diagnostics: {
        leadflow_available: true,
        supabase_available: false,
        supabase_enabled: false,
        supabase_error: null,
      },
    };
  }

  private emptyResponse(
    limit: number,
    cursor: string | null,
  ): UnifiedCrmInboxResponse {
    return {
      data: [],
      page: {
        limit,
        cursor,
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
        supabase_enabled: false,
        supabase_error: 'supabase_disabled_in_pr1',
      },
    };
  }
}

