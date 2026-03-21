import { LeadsService } from './leads.service';

describe('LeadsService', () => {
  it('creates a draft lead aggregate', () => {
    const service = new LeadsService();

    const result = service.createDraft({
      workspaceId: 'workspace-1',
      funnelId: 'funnel-1',
      sourceChannel: 'form',
      fullName: 'Jane Prospect',
      email: 'jane@example.com',
      tags: ['inbound'],
    });

    expect(result.workspaceId).toBe('workspace-1');
    expect(result.funnelId).toBe('funnel-1');
    expect(result.status).toBe('captured');
    expect(result.currentAssignmentId).toBeNull();
    expect(result.tags).toEqual(['inbound']);
    expect(typeof result.id).toBe('string');
  });
});
