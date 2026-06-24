import { AccountProvisioningController } from './account-provisioning.controller';
import type { AccountProvisioningService } from './account-provisioning.service';

describe('AccountProvisioningController', () => {
  it('returns /member/crm as the individual onboarding redirect', async () => {
    const accountProvisioningService = {
      provisionIndividualAccount: jest.fn().mockResolvedValue({
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
        userId: 'user-1',
        accountType: 'individual',
        teamType: 'personal',
      }),
    } as unknown as AccountProvisioningService;
    const controller = new AccountProvisioningController(
      accountProvisioningService,
    );

    await expect(
      controller.provisionIndividualAccount(
        {
          id: 'user-1',
          fullName: 'Ana Owner',
          email: 'ana@example.com',
          role: 'MEMBER',
          workspaceId: null,
          teamId: null,
          sponsorId: null,
          homePath: '/member',
          workspace: null,
          team: null,
          sponsor: null,
        },
        { businessName: 'Ana Studio' },
      ),
    ).resolves.toEqual({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      sponsorId: 'sponsor-1',
      userId: 'user-1',
      accountType: 'individual',
      teamType: 'personal',
      redirectTo: '/member/crm',
    });
  });
});
