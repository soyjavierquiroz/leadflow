import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import {
  ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY,
  ROLES_KEY,
} from '../auth/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FunnelArsenalController } from './funnel-arsenal.controller';
import type { FunnelArsenalService } from './funnel-arsenal.service';

describe('FunnelArsenalController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    fullName: 'Ana Owner',
    email: 'ana@example.com',
    role: UserRole.TEAM_ADMIN,
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    sponsorId: 'sponsor-1',
    homePath: '/member',
    workspace: {
      id: 'workspace-1',
      name: 'Ana Studio',
      slug: 'ana-studio',
      primaryDomain: null,
    },
    team: {
      id: 'team-1',
      name: 'Ana Studio',
      code: 'ana-studio',
    },
    sponsor: {
      id: 'sponsor-1',
      displayName: 'Ana',
      email: 'ana@example.com',
      isActive: true,
      availabilityStatus: 'available',
    },
  };

  it('lists templates for the authenticated current team', async () => {
    const service = {
      listForCurrentTeam: jest.fn().mockResolvedValue({
        blueprintKey: 'blueprint.beauty_aesthetics.v1',
        templates: [],
      }),
    } as unknown as FunnelArsenalService;
    const controller = new FunnelArsenalController(service);

    await expect(controller.listMine(user)).resolves.toEqual({
      blueprintKey: 'blueprint.beauty_aesthetics.v1',
      templates: [],
    });
    expect(service.listForCurrentTeam).toHaveBeenCalledWith(user);
  });

  it('enables a template for the authenticated current team', async () => {
    const service = {
      enableForCurrentTeam: jest.fn().mockResolvedValue({
        templateKey: 'beauty-aesthetics-diagnosis-booking',
        enabled: true,
        publicationId: 'publication-1',
      }),
    } as unknown as FunnelArsenalService;
    const controller = new FunnelArsenalController(service);

    await expect(
      controller.enableMine(user, 'beauty-aesthetics-diagnosis-booking'),
    ).resolves.toMatchObject({
      templateKey: 'beauty-aesthetics-diagnosis-booking',
      enabled: true,
      publicationId: 'publication-1',
    });
    expect(service.enableForCurrentTeam).toHaveBeenCalledWith(
      user,
      'beauty-aesthetics-diagnosis-booking',
    );
  });

  it('uses the current operational member access guard pattern', () => {
    const reflector = new Reflector();
    const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      FunnelArsenalController.prototype.listMine,
      FunnelArsenalController,
    ]);
    const activeTeamAdminAccess = reflector.getAllAndOverride<boolean>(
      ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY,
      [FunnelArsenalController.prototype.listMine, FunnelArsenalController],
    );

    expect(roles).toEqual([UserRole.MEMBER]);
    expect(activeTeamAdminAccess).toBe(true);
  });
});
