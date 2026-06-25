import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import {
  ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY,
  ROLES_KEY,
} from '../auth/roles.decorator';
import { CommercialProfileController } from './commercial-profile.controller';
import type { CommercialProfileService } from './commercial-profile.service';

describe('CommercialProfileController', () => {
  const user = {
    id: 'user-1',
    fullName: 'Ana Owner',
    email: 'ana@example.com',
    role: UserRole.TEAM_ADMIN,
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    sponsorId: 'sponsor-1',
    homePath: '/member',
    workspace: null,
    team: null,
    sponsor: null,
  };

  it('gets the profile for the authenticated current team', async () => {
    const commercialProfileService = {
      assertCurrentTeamSupportsCommercialProfile: jest.fn(),
      getCommercialProfileSnapshotForTeam: jest.fn().mockResolvedValue({
        profile: {
          id: 'profile-1',
          teamId: 'team-1',
          businessName: 'Ana Studio',
          vertical: 'beauty_aesthetics',
          industry: 'salon',
          businessModel: 'service_provider',
          blueprintKey: 'blueprint.beauty_aesthetics.v1',
        },
        isComplete: true,
      }),
    } as unknown as CommercialProfileService;
    const controller = new CommercialProfileController(
      commercialProfileService,
    );

    await expect(controller.getMe(user)).resolves.toMatchObject({
      isComplete: true,
      profile: {
        teamId: 'team-1',
        blueprintKey: 'blueprint.beauty_aesthetics.v1',
      },
    });
    expect(
      commercialProfileService.getCommercialProfileSnapshotForTeam,
    ).toHaveBeenCalledWith('team-1');
  });

  it('updates the profile for the authenticated current team', async () => {
    const profile = {
      id: 'profile-1',
      teamId: 'team-1',
      businessName: 'Ana Studio',
      vertical: 'real_estate',
      industry: 'residential',
      businessModel: 'service_provider',
      blueprintKey: 'blueprint.real_estate.v1',
    };
    const commercialProfileService = {
      assertCurrentTeamSupportsCommercialProfile: jest.fn(),
      updateCommercialProfileForTeam: jest.fn().mockResolvedValue(profile),
      isCommercialProfileComplete: jest.fn().mockReturnValue(true),
    } as unknown as CommercialProfileService;
    const controller = new CommercialProfileController(
      commercialProfileService,
    );

    await expect(
      controller.updateMe(user, {
        vertical: 'real_estate',
      }),
    ).resolves.toEqual({
      profile,
      isComplete: true,
    });
    expect(
      commercialProfileService.updateCommercialProfileForTeam,
    ).toHaveBeenCalledWith('team-1', {
      vertical: 'real_estate',
    });
  });

  it('uses the current operational member access guard pattern', () => {
    const reflector = new Reflector();
    const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      CommercialProfileController.prototype.getMe,
      CommercialProfileController,
    ]);
    const activeTeamAdminAccess = reflector.getAllAndOverride<boolean>(
      ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY,
      [CommercialProfileController.prototype.getMe, CommercialProfileController],
    );

    expect(roles).toEqual([UserRole.MEMBER]);
    expect(activeTeamAdminAccess).toBe(true);
  });
});
