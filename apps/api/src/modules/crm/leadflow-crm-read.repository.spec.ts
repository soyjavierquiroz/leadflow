import { LeadflowCrmReadRepository } from './leadflow-crm-read.repository';

describe('LeadflowCrmReadRepository', () => {
  it('builds the unassigned filter without current or active fallback owner', () => {
    const repository = new LeadflowCrmReadRepository({} as never);

    const where = repository.buildWhere(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
      {
        owner: 'unassigned',
      },
    );

    expect(where).toMatchObject({
      workspaceId: 'workspace-1',
      AND: expect.arrayContaining([
        {
          AND: [
            {
              currentAssignmentId: null,
            },
            {
              assignments: {
                none: {
                  status: {
                    in: ['pending', 'assigned', 'accepted'],
                  },
                },
              },
            },
          ],
        },
      ]),
    });
  });
});

