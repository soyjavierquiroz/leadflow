import { TeamsService } from '../teams/teams.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

describe('team provisioning defaults', () => {
  it('keeps existing team workspace and team draft semantics unchanged', () => {
    const workspacesService = new WorkspacesService();
    const teamsService = new TeamsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const workspace = workspacesService.createDraft({
      name: 'Commercial Workspace',
      slug: 'commercial-workspace',
    });
    const team = teamsService.createDraft({
      workspaceId: workspace.id,
      name: 'Commercial Team',
      code: 'commercial-team',
    });

    expect(workspace.accountType).toBe('team');
    expect(team.teamType).toBe('commercial_team');
  });
});
