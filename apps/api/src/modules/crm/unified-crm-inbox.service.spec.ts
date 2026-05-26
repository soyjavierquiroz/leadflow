import { LeadflowCrmReadRepository } from './leadflow-crm-read.repository';
import { UnifiedCrmInboxService, normalizeCrmLimit } from './unified-crm-inbox.service';
import { UnifiedCrmMapper } from './unified-crm.mapper';

describe('UnifiedCrmInboxService', () => {
  const scope = {
    workspaceId: 'workspace-1',
    teamId: 'team-1',
  };

  it('returns an empty PR1 response for conversational tab', async () => {
    const repository = {
      findMany: jest.fn(),
      count: jest.fn(),
    };
    const service = new UnifiedCrmInboxService(
      repository as unknown as LeadflowCrmReadRepository,
      {} as UnifiedCrmMapper,
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
    );

    const result = await service.getInbox(scope, { source: 'supabase' });

    expect(result.data).toEqual([]);
    expect(result.diagnostics).toMatchObject({
      leadflow_available: true,
      supabase_available: false,
      supabase_enabled: false,
      supabase_error: 'supabase_disabled_in_pr1',
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
});

