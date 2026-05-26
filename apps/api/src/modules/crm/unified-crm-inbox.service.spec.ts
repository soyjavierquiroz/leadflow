import { LeadflowCrmReadRepository } from './leadflow-crm-read.repository';
import {
  KurukinCrmReadClient,
  KurukinCrmReadError,
} from './kurukin-crm-read.client';
import { UnifiedCrmInboxService, normalizeCrmLimit } from './unified-crm-inbox.service';
import { UnifiedCrmMapper } from './unified-crm.mapper';

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

  it('returns an empty PR1 response for conversational tab', async () => {
    const repository = {
      findMany: jest.fn(),
      count: jest.fn(),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      {} as UnifiedCrmMapper,
      disabledKurukinClient as unknown as KurukinCrmReadClient,
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
    );

    await service.getInbox(scope, { tab: 'unassigned', limit: '10' });

    expect(repository.findMany).toHaveBeenCalledWith({
      scope,
      filters: {
        q: null,
        status: null,
        owner: 'unassigned',
      },
      limit: 10,
    });
  });

  it('respects default limit and caps explicit limit at 100', () => {
    expect(normalizeCrmLimit(undefined)).toBe(50);
    expect(normalizeCrmLimit('25')).toBe(25);
    expect(normalizeCrmLimit('500')).toBe(100);
    expect(normalizeCrmLimit('0')).toBe(50);
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
      findMany: jest.fn(),
      count: jest.fn(),
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
    expect(repository.findMany).not.toHaveBeenCalled();
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
        activity: {
          last_activity_at: '2026-05-22T10:00:00.000Z',
        },
      }),
      fromSupabase: jest.fn(),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      mapper as unknown as UnifiedCrmMapper,
      kurukinClient as unknown as KurukinCrmReadClient,
    );

    const result = await service.getInbox(scope, { tab: 'all' });

    expect(result.data).toEqual([
      {
        id: 'leadflow:lead-1',
        source: 'leadflow',
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
  });

  it('maps owner=unassigned into Supabase filters', async () => {
    const repository = {
      findMany: jest.fn(),
      count: jest.fn(),
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
    );

    await service.getInbox(scope, {
      tab: 'conversational',
      owner: 'unassigned',
      instanceId: 'instance-1',
      verticalKey: 'dxn',
    });

    expect(kurukinClient.listConversationalLeads).toHaveBeenCalledWith({
      tenantId: 'team-1',
      limit: 50,
      q: null,
      status: null,
      owner: 'unassigned',
      instanceId: 'instance-1',
      verticalKey: 'dxn',
    });
  });
});
