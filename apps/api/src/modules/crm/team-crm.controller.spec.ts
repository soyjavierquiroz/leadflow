import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CrmKloserMissionService } from './crm-kloser-mission.service';
import { CrmOutreachQueueService } from './crm-outreach-queue.service';
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

const buildController = (service: Partial<UnifiedCrmInboxService>) =>
  new TeamCrmController(
    service as UnifiedCrmInboxService,
    {
      listOutreachQueue: jest.fn(),
      dryRunOutreach: jest.fn(),
      getDispatchMetrics: jest.fn(),
      requeueOutreach: jest.fn(),
    } as unknown as CrmOutreachQueueService,
    {
      getHealth: jest.fn(),
      getMetrics: jest.fn(),
    } as unknown as CrmKloserMissionService,
  );

describe('TeamCrmController', () => {
  it('ignores teamId query param for TEAM_ADMIN users', async () => {
    const service = {
      getInbox: jest.fn().mockResolvedValue({ data: [] }),
    };
    const controller = buildController(
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
    const controller = buildController(
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
    const controller = buildController({
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

  it('uses team scope for outreach queue read-only endpoint', async () => {
    const outreachQueueService = {
      listOutreachQueue: jest.fn().mockResolvedValue({ items: [] }),
      dryRunOutreach: jest.fn(),
      getDispatchMetrics: jest.fn(),
      requeueOutreach: jest.fn(),
    };
    const controller = new TeamCrmController(
      { getInbox: jest.fn() } as unknown as UnifiedCrmInboxService,
      outreachQueueService as unknown as CrmOutreachQueueService,
      {
        getHealth: jest.fn(),
        getMetrics: jest.fn(),
      } as unknown as CrmKloserMissionService,
    );

    await controller.listOutreachQueue(buildUser(), {
      status: 'queued',
    });

    expect(outreachQueueService.listOutreachQueue).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
      {
        status: 'queued',
      },
    );
  });

  it('uses team scope for outreach dry run endpoint', async () => {
    const outreachQueueService = {
      listOutreachQueue: jest.fn(),
      dryRunOutreach: jest.fn().mockResolvedValue({ queue_id: 'queue-1' }),
      getDispatchMetrics: jest.fn(),
      requeueOutreach: jest.fn(),
    };
    const controller = new TeamCrmController(
      { getInbox: jest.fn() } as unknown as UnifiedCrmInboxService,
      outreachQueueService as unknown as CrmOutreachQueueService,
      {
        getHealth: jest.fn(),
        getMetrics: jest.fn(),
      } as unknown as CrmKloserMissionService,
    );

    await controller.dryRunOutreachQueueItem(buildUser(), 'queue-1');

    expect(outreachQueueService.dryRunOutreach).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
      'queue-1',
    );
  });

  it('uses team scope for outreach dispatch metrics endpoint', async () => {
    const outreachQueueService = {
      listOutreachQueue: jest.fn(),
      dryRunOutreach: jest.fn(),
      getDispatchMetrics: jest.fn().mockResolvedValue({ queued: 1 }),
      requeueOutreach: jest.fn(),
    };
    const controller = new TeamCrmController(
      { getInbox: jest.fn() } as unknown as UnifiedCrmInboxService,
      outreachQueueService as unknown as CrmOutreachQueueService,
      {
        getHealth: jest.fn(),
        getMetrics: jest.fn(),
      } as unknown as CrmKloserMissionService,
    );

    await controller.getOutreachDispatchMetrics(buildUser());

    expect(outreachQueueService.getDispatchMetrics).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
    });
  });

  it('uses team scope for outreach requeue endpoint', async () => {
    const outreachQueueService = {
      listOutreachQueue: jest.fn(),
      dryRunOutreach: jest.fn(),
      getDispatchMetrics: jest.fn(),
      requeueOutreach: jest.fn().mockResolvedValue({ id: 'queue-1' }),
    };
    const controller = new TeamCrmController(
      { getInbox: jest.fn() } as unknown as UnifiedCrmInboxService,
      outreachQueueService as unknown as CrmOutreachQueueService,
      {
        getHealth: jest.fn(),
        getMetrics: jest.fn(),
      } as unknown as CrmKloserMissionService,
    );

    await controller.requeueOutreachQueueItem(buildUser(), 'queue-1');

    expect(outreachQueueService.requeueOutreach).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
      'queue-1',
    );
  });
});
