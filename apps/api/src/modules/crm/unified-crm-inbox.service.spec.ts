import { LeadflowCrmReadRepository } from './leadflow-crm-read.repository';
import { CrmIdentityMatcher } from './crm-identity-matcher';
import {
  KurukinCrmReadClient,
  KurukinCrmReadError,
} from './kurukin-crm-read.client';
import {
  UnifiedCrmInboxService,
  normalizeCrmLimit,
} from './unified-crm-inbox.service';
import { UnifiedCrmMapper } from './unified-crm.mapper';
import type { UnifiedCrmLead } from './unified-crm.types';

describe('UnifiedCrmInboxService', () => {
  const scope = {
    workspaceId: 'workspace-1',
    teamId: 'team-1',
  };
  const disabledKurukinClient = {
    isEnabled: jest.fn().mockReturnValue(false),
    isConfigured: jest.fn().mockReturnValue(false),
    listConversationalLeads: jest.fn(),
    countConversationalLeads: jest.fn(),
  };
  const identityMatcher = {
    markPossibleDuplicates: jest.fn((rows) => rows),
  };
  const makeLead = (
    id: string,
    activityAt: string,
    overrides: Partial<UnifiedCrmLead> = {},
  ): UnifiedCrmLead =>
    ({
      id,
      source: id.startsWith('supabase:') ? 'supabase' : 'leadflow',
      activity: {
        last_activity_at: activityAt,
      },
      flags: {
        is_registered: id.startsWith('leadflow:'),
        is_conversational: id.startsWith('supabase:'),
        has_assignment: false,
        is_orphaned: true,
        is_stagnant: false,
        is_closed: false,
        possible_duplicate: false,
      },
      created_at: activityAt,
      updated_at: activityAt,
      ...overrides,
    }) as UnifiedCrmLead;

  it('returns an empty PR1 response for conversational tab', async () => {
    const repository = {
      findMany: jest.fn(),
      count: jest.fn(),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      {} as UnifiedCrmMapper,
      disabledKurukinClient as unknown as KurukinCrmReadClient,
      identityMatcher as unknown as CrmIdentityMatcher,
    );

    const result = await service.getInbox(scope, { tab: 'conversational' });

    expect(result.data).toEqual([]);
    expect(result.counts.conversacionales).toBe(0);
    expect(result.diagnostics.supabase_enabled).toBe(false);
    expect(repository.findMany).not.toHaveBeenCalled();
  });

  it('returns empty data for source=supabase with disabled diagnostics', async () => {
    const repository = {
      findMany: jest.fn(),
      count: jest.fn(),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      {} as UnifiedCrmMapper,
      disabledKurukinClient as unknown as KurukinCrmReadClient,
      identityMatcher as unknown as CrmIdentityMatcher,
    );

    const result = await service.getInbox(scope, { source: 'supabase' });

    expect(result.data).toEqual([]);
    expect(result.diagnostics).toMatchObject({
      leadflow_available: true,
      supabase_available: false,
      supabase_enabled: false,
      supabase_error: null,
    });
    expect(repository.count).not.toHaveBeenCalled();
  });

  it('passes the unassigned filter for tab=unassigned', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const mapper = {
      fromLeadflow: jest.fn(),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      mapper as unknown as UnifiedCrmMapper,
      disabledKurukinClient as unknown as KurukinCrmReadClient,
      identityMatcher as unknown as CrmIdentityMatcher,
    );

    await service.getInbox(scope, { tab: 'unassigned', limit: '10' });

    expect(repository.findMany).toHaveBeenCalledWith({
      scope,
      filters: {
        q: null,
        status: null,
        owner: 'unassigned',
      },
      limit: 11,
      cursor: null,
    });
  });

  it('respects default limit and caps explicit limit at 100', () => {
    expect(normalizeCrmLimit(undefined)).toBe(50);
    expect(normalizeCrmLimit('25')).toBe(25);
    expect(normalizeCrmLimit('500')).toBe(100);
    expect(normalizeCrmLimit('0')).toBe(50);
  });

  it('fetches a 101-row lookahead when limit is capped at 100', async () => {
    const records = Array.from({ length: 101 }, (_, index) => ({
      id: `lead-${index + 1}`,
    }));
    const repository = {
      findMany: jest.fn().mockResolvedValue(records),
      count: jest.fn().mockResolvedValue(101),
    };
    const mapper = {
      fromLeadflow: jest.fn((record: { id: string }) =>
        makeLead(
          `leadflow:${record.id}`,
          new Date(
            Date.UTC(2026, 4, 26, 12, 0, 0) -
              (Number(record.id.split('-')[1]) - 1) * 60_000,
          ).toISOString(),
        ),
      ),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      mapper as unknown as UnifiedCrmMapper,
      disabledKurukinClient as unknown as KurukinCrmReadClient,
      identityMatcher as unknown as CrmIdentityMatcher,
    );

    const result = await service.getInbox(scope, {
      tab: 'registered',
      limit: '500',
    });

    expect(result.page.limit).toBe(100);
    expect(result.data).toHaveLength(100);
    expect(result.page.next_cursor).toEqual(expect.any(String));
    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 101,
      }),
    );
  });

  it('returns next_cursor=null when there are no more rows', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([{ id: 'lead-1' }, { id: 'lead-2' }]),
      count: jest.fn().mockResolvedValue(2),
    };
    const mapper = {
      fromLeadflow: jest.fn((record: { id: string }) =>
        makeLead(
          `leadflow:${record.id}`,
          new Date(
            Date.UTC(2026, 4, 26, 12, 0, 0) -
              (Number(record.id.split('-')[1]) - 1) * 60_000,
          ).toISOString(),
        ),
      ),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      mapper as unknown as UnifiedCrmMapper,
      disabledKurukinClient as unknown as KurukinCrmReadClient,
      identityMatcher as unknown as CrmIdentityMatcher,
    );

    const result = await service.getInbox(scope, {
      tab: 'registered',
      limit: '2',
    });

    expect(result.data.map((item) => item.id)).toEqual([
      'leadflow:lead-1',
      'leadflow:lead-2',
    ]);
    expect(result.page.next_cursor).toBeNull();
  });

  it('uses cursor to return the next page without duplicate rows', async () => {
    const records = [{ id: 'lead-1' }, { id: 'lead-2' }, { id: 'lead-3' }];
    const repository = {
      findMany: jest.fn().mockResolvedValue(records),
      count: jest.fn().mockResolvedValue(3),
    };
    const mapper = {
      fromLeadflow: jest.fn((record: { id: string }) =>
        makeLead(
          `leadflow:${record.id}`,
          new Date(
            Date.UTC(2026, 4, 26, 12, 0, 0) -
              (Number(record.id.split('-')[1]) - 1) * 60_000,
          ).toISOString(),
        ),
      ),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      mapper as unknown as UnifiedCrmMapper,
      disabledKurukinClient as unknown as KurukinCrmReadClient,
      identityMatcher as unknown as CrmIdentityMatcher,
    );

    const firstPage = await service.getInbox(scope, {
      tab: 'registered',
      limit: '2',
    });
    const secondPage = await service.getInbox(scope, {
      tab: 'registered',
      limit: '2',
      cursor: firstPage.page.next_cursor ?? undefined,
    });

    expect(firstPage.data.map((item) => item.id)).toEqual([
      'leadflow:lead-1',
      'leadflow:lead-2',
    ]);
    expect(secondPage.data.map((item) => item.id)).toEqual(['leadflow:lead-3']);
    expect(
      firstPage.data.some((item) =>
        secondPage.data.map((row) => row.id).includes(item.id),
      ),
    ).toBe(false);
    expect(repository.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursor: expect.objectContaining({
          id: 'leadflow:lead-2',
        }),
      }),
    );
  });

  it('returns missing DB URL diagnostics without throwing when enabled but unconfigured', async () => {
    const repository = {
      findMany: jest.fn(),
      count: jest.fn(),
    };
    const kurukinClient = {
      isEnabled: jest.fn().mockReturnValue(true),
      isConfigured: jest.fn().mockReturnValue(false),
      listConversationalLeads: jest.fn(),
      countConversationalLeads: jest.fn(),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      {} as UnifiedCrmMapper,
      kurukinClient as unknown as KurukinCrmReadClient,
      identityMatcher as unknown as CrmIdentityMatcher,
    );

    const result = await service.getInbox(scope, { tab: 'conversational' });

    expect(result.data).toEqual([]);
    expect(result.diagnostics).toMatchObject({
      supabase_enabled: true,
      supabase_available: false,
      supabase_error: 'missing_database_url',
    });
    expect(kurukinClient.listConversationalLeads).not.toHaveBeenCalled();
  });

  it('returns mocked Supabase rows for conversational tab', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const kurukinClient = {
      isEnabled: jest.fn().mockReturnValue(true),
      isConfigured: jest.fn().mockReturnValue(true),
      listConversationalLeads: jest
        .fn()
        .mockResolvedValue([{ id: 'saas-lead-1' }]),
      countConversationalLeads: jest.fn().mockResolvedValue(1),
    };
    const mapper = {
      fromSupabase: jest.fn().mockReturnValue({
        id: 'supabase:saas-lead-1',
        source: 'supabase',
        activity: {
          last_activity_at: '2026-05-24T10:00:00.000Z',
        },
      }),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      mapper as unknown as UnifiedCrmMapper,
      kurukinClient as unknown as KurukinCrmReadClient,
      identityMatcher as unknown as CrmIdentityMatcher,
    );

    const result = await service.getInbox(scope, { tab: 'conversational' });

    expect(result.data).toEqual([
      {
        id: 'supabase:saas-lead-1',
        source: 'supabase',
        activity: {
          last_activity_at: '2026-05-24T10:00:00.000Z',
        },
      },
    ]);
    expect(result.counts.conversacionales).toBe(1);
    expect(result.diagnostics.supabase_available).toBe(true);
    expect(repository.findMany).toHaveBeenCalled();
  });

  it('combines and sorts LeadFlow and Supabase rows for all tab', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([{ id: 'lead-1' }]),
      count: jest.fn().mockResolvedValue(1),
    };
    const kurukinClient = {
      isEnabled: jest.fn().mockReturnValue(true),
      isConfigured: jest.fn().mockReturnValue(true),
      listConversationalLeads: jest
        .fn()
        .mockResolvedValue([{ id: 'saas-lead-1' }]),
      countConversationalLeads: jest.fn().mockResolvedValue(1),
    };
    const mapper = {
      fromLeadflow: jest.fn().mockReturnValue({
        id: 'leadflow:lead-1',
        source: 'leadflow',
        activity: {
          last_activity_at: '2026-05-22T10:00:00.000Z',
        },
      }),
      fromSupabase: jest.fn().mockReturnValue({
        id: 'supabase:saas-lead-1',
        source: 'supabase',
        activity: {
          last_activity_at: '2026-05-24T10:00:00.000Z',
        },
      }),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      mapper as unknown as UnifiedCrmMapper,
      kurukinClient as unknown as KurukinCrmReadClient,
      identityMatcher as unknown as CrmIdentityMatcher,
    );

    const result = await service.getInbox(scope, { tab: 'all' });

    expect(result.data.map((item) => item.id)).toEqual([
      'supabase:saas-lead-1',
      'leadflow:lead-1',
    ]);
    expect(result.counts).toMatchObject({
      registrados: 1,
      conversacionales: 1,
      todos: 2,
      sin_owner: 2,
    });
  });

  it('applies the identity matcher for all tab and counts possible duplicates', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([{ id: 'lead-1' }]),
      count: jest.fn().mockResolvedValue(1),
    };
    const kurukinClient = {
      isEnabled: jest.fn().mockReturnValue(true),
      isConfigured: jest.fn().mockReturnValue(true),
      listConversationalLeads: jest
        .fn()
        .mockResolvedValue([{ id: 'saas-lead-1' }]),
      countConversationalLeads: jest.fn().mockResolvedValue(1),
    };
    const mapper = {
      fromLeadflow: jest.fn().mockReturnValue({
        id: 'leadflow:lead-1',
        source: 'leadflow',
        flags: { possible_duplicate: false },
        activity: {
          last_activity_at: '2026-05-22T10:00:00.000Z',
        },
      }),
      fromSupabase: jest.fn().mockReturnValue({
        id: 'supabase:saas-lead-1',
        source: 'supabase',
        flags: { possible_duplicate: false },
        activity: {
          last_activity_at: '2026-05-24T10:00:00.000Z',
        },
      }),
    };
    const matcher = {
      markPossibleDuplicates: jest.fn((rows: UnifiedCrmLead[]) =>
        rows.map((row) =>
          row.id === 'supabase:saas-lead-1'
            ? { ...row, flags: { possible_duplicate: true } }
            : row,
        ),
      ),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      mapper as unknown as UnifiedCrmMapper,
      kurukinClient as unknown as KurukinCrmReadClient,
      matcher as unknown as CrmIdentityMatcher,
    );

    const result = await service.getInbox(scope, { tab: 'all' });

    expect(matcher.markPossibleDuplicates).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'leadflow:lead-1' }),
      expect.objectContaining({ id: 'supabase:saas-lead-1' }),
    ]);
    expect(result.counts.posibles_duplicados).toBe(1);
  });

  it('returns only possible duplicates for duplicates tab', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([{ id: 'lead-1' }]),
      count: jest.fn().mockResolvedValue(1),
    };
    const kurukinClient = {
      isEnabled: jest.fn().mockReturnValue(true),
      isConfigured: jest.fn().mockReturnValue(true),
      listConversationalLeads: jest
        .fn()
        .mockResolvedValue([{ id: 'saas-lead-1' }]),
      countConversationalLeads: jest.fn().mockResolvedValue(1),
    };
    const mapper = {
      fromLeadflow: jest.fn().mockReturnValue({
        id: 'leadflow:lead-1',
        source: 'leadflow',
        flags: { possible_duplicate: false },
        activity: {
          last_activity_at: '2026-05-22T10:00:00.000Z',
        },
      }),
      fromSupabase: jest.fn().mockReturnValue({
        id: 'supabase:saas-lead-1',
        source: 'supabase',
        flags: { possible_duplicate: false },
        activity: {
          last_activity_at: '2026-05-24T10:00:00.000Z',
        },
      }),
    };
    const matcher = {
      markPossibleDuplicates: jest.fn((rows: UnifiedCrmLead[]) =>
        rows.map((row) => ({
          ...row,
          flags: {
            possible_duplicate: row.id === 'leadflow:lead-1',
          },
        })),
      ),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      mapper as unknown as UnifiedCrmMapper,
      kurukinClient as unknown as KurukinCrmReadClient,
      matcher as unknown as CrmIdentityMatcher,
    );

    const result = await service.getInbox(scope, { tab: 'duplicates' });

    expect(result.data.map((item) => item.id)).toEqual(['leadflow:lead-1']);
    expect(result.counts.posibles_duplicados).toBe(1);
  });

  it('keeps LeadFlow rows when Supabase fails', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([{ id: 'lead-1' }]),
      count: jest.fn().mockResolvedValue(1),
    };
    const kurukinClient = {
      isEnabled: jest.fn().mockReturnValue(true),
      isConfigured: jest.fn().mockReturnValue(true),
      listConversationalLeads: jest
        .fn()
        .mockRejectedValue(
          new KurukinCrmReadError('query_failed', 'Query failed.'),
        ),
      countConversationalLeads: jest.fn(),
    };
    const mapper = {
      fromLeadflow: jest.fn().mockReturnValue({
        id: 'leadflow:lead-1',
        source: 'leadflow',
        flags: {
          possible_duplicate: false,
        },
        activity: {
          last_activity_at: '2026-05-22T10:00:00.000Z',
        },
      }),
      fromSupabase: jest.fn(),
    };
    const matcher = {
      markPossibleDuplicates: jest.fn((rows) => rows),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      mapper as unknown as UnifiedCrmMapper,
      kurukinClient as unknown as KurukinCrmReadClient,
      matcher as unknown as CrmIdentityMatcher,
    );

    const result = await service.getInbox(scope, { tab: 'all' });

    expect(result.data).toEqual([
      {
        id: 'leadflow:lead-1',
        source: 'leadflow',
        flags: {
          possible_duplicate: false,
        },
        activity: {
          last_activity_at: '2026-05-22T10:00:00.000Z',
        },
      },
    ]);
    expect(result.diagnostics).toMatchObject({
      supabase_enabled: true,
      supabase_available: false,
      supabase_error: 'query_failed',
    });
    expect(matcher.markPossibleDuplicates).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'leadflow:lead-1' }),
    ]);
  });

  it('maps owner=unassigned into Supabase filters', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const kurukinClient = {
      isEnabled: jest.fn().mockReturnValue(true),
      isConfigured: jest.fn().mockReturnValue(true),
      listConversationalLeads: jest.fn().mockResolvedValue([]),
      countConversationalLeads: jest.fn().mockResolvedValue(0),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      { fromSupabase: jest.fn() } as unknown as UnifiedCrmMapper,
      kurukinClient as unknown as KurukinCrmReadClient,
      identityMatcher as unknown as CrmIdentityMatcher,
    );

    await service.getInbox(scope, {
      tab: 'conversational',
      owner: 'unassigned',
      instanceId: 'instance-1',
      verticalKey: 'dxn',
    });

    expect(kurukinClient.listConversationalLeads).toHaveBeenCalledWith({
      tenantId: 'team-1',
      limit: 51,
      q: null,
      status: null,
      owner: 'unassigned',
      instanceId: 'instance-1',
      verticalKey: 'dxn',
      cursor: null,
    });
  });
});
