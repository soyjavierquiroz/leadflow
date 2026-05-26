import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TeamCrmController } from './team-crm.controller';
import { UnifiedCrmInboxService } from './unified-crm-inbox.service';

const buildUser = (
  input: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: 'user-1',
  fullName: 'Team Admin',
  email: 'admin@example.com',
  role: UserRole.TEAM_ADMIN,
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  sponsorId: null,
  homePath: '/team',
  workspace: null,
  team: null,
  sponsor: null,
  ...input,
});

describe('TeamCrmController', () => {
  it('ignores teamId query param for TEAM_ADMIN users', async () => {
    const service = {
      getInbox: jest.fn().mockResolvedValue({ data: [] }),
    };
    const controller = new TeamCrmController(
      service as unknown as UnifiedCrmInboxService,
    );

    await controller.getInbox(buildUser(), {
      teamId: 'other-team',
      tab: 'registered',
    });

    expect(service.getInbox).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
      {
        teamId: 'other-team',
        tab: 'registered',
      },
    );
  });

  it('allows SUPER_ADMIN users to scope with teamId query param', async () => {
    const service = {
      getInbox: jest.fn().mockResolvedValue({ data: [] }),
    };
    const controller = new TeamCrmController(
      service as unknown as UnifiedCrmInboxService,
    );

    await controller.getInbox(
      buildUser({
        role: UserRole.SUPER_ADMIN,
        teamId: 'fallback-team',
      }),
      {
        teamId: 'explicit-team',
      },
    );

    expect(service.getInbox).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        teamId: 'explicit-team',
      },
      {
        teamId: 'explicit-team',
      },
    );
  });

  it('throws when workspace or team scope is missing', async () => {
    const controller = new TeamCrmController({
      getInbox: jest.fn(),
    } as unknown as UnifiedCrmInboxService);

    expect(() =>
      controller.getInbox(
        buildUser({
          workspaceId: null,
          teamId: null,
        }),
        {},
      ),
    ).toThrow(BadRequestException);
  });
});
