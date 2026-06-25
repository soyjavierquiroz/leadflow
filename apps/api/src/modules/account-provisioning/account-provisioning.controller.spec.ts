import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/roles.decorator';
import {
  AccountProvisioningController,
  SystemIndividualAccountsController,
} from './account-provisioning.controller';
import type { AccountProvisioningService } from './account-provisioning.service';

describe('AccountProvisioningController', () => {
  it('returns /member/crm as the individual onboarding redirect', async () => {
    const accountProvisioningService = {
      provisionIndividualAccount: jest.fn().mockResolvedValue({
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
        userId: 'user-1',
        niche: 'beauty',
        commercialProfile: {
          vertical: 'beauty_aesthetics',
          industry: 'salon',
          businessModel: 'service_provider',
          legacyNiche: 'beauty',
          presetVersion: 'v2',
          blueprintKey: 'blueprint.beauty_aesthetics.v1',
          blueprintVersion: 'v1',
        },
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
      niche: 'beauty',
      commercialProfile: {
        vertical: 'beauty_aesthetics',
        industry: 'salon',
        businessModel: 'service_provider',
        legacyNiche: 'beauty',
        presetVersion: 'v2',
        blueprintKey: 'blueprint.beauty_aesthetics.v1',
        blueprintVersion: 'v1',
      },
      accountType: 'individual',
      teamType: 'personal',
      redirectTo: '/member/crm',
    });
  });
});

describe('SystemIndividualAccountsController', () => {
  it('delegates individual account creation to the provisioning service', async () => {
    const accountProvisioningService = {
      createSystemIndividualAccount: jest.fn().mockResolvedValue({
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
        userId: 'user-1',
        niche: 'beauty',
        commercialProfile: {
          vertical: 'beauty_aesthetics',
          industry: 'salon',
          businessModel: 'service_provider',
          legacyNiche: 'beauty',
          presetVersion: 'v2',
          blueprintKey: 'blueprint.beauty_aesthetics.v1',
          blueprintVersion: 'v1',
        },
        accountType: 'individual',
        teamType: 'personal',
        email: 'ana@example.com',
        temporaryPassword: 'TempPass123',
        loginUrl: '/login',
        recommendedRedirect: '/member/crm',
      }),
    } as unknown as AccountProvisioningService;
    const controller = new SystemIndividualAccountsController(
      accountProvisioningService,
    );

    await expect(
      controller.createIndividualAccount({
        name: 'Ana Owner',
        email: 'ana@example.com',
        businessName: 'Ana Studio',
      }),
    ).resolves.toMatchObject({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      sponsorId: 'sponsor-1',
      email: 'ana@example.com',
      loginUrl: '/login',
      recommendedRedirect: '/member/crm',
    });
  });

  it('requires SUPER_ADMIN on the system endpoint', () => {
    const reflector = new Reflector();
    const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      SystemIndividualAccountsController.prototype.createIndividualAccount,
      SystemIndividualAccountsController,
    ]);

    expect(roles).toEqual([UserRole.SUPER_ADMIN]);
  });
});
