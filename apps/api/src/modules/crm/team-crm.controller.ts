import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { CrmKloserMissionService } from './crm-kloser-mission.service';
import { CrmOutreachQueueService } from './crm-outreach-queue.service';
import type { CrmOutreachQueueQuery } from './crm-outreach-queue.service';
import { UnifiedCrmInboxService } from './unified-crm-inbox.service';
import type { UnifiedCrmInboxQuery } from './unified-crm.types';

@Controller('team/crm')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class TeamCrmController {
  constructor(
    private readonly unifiedCrmInboxService: UnifiedCrmInboxService,
    private readonly outreachQueueService: CrmOutreachQueueService,
    private readonly kloserMissionService: CrmKloserMissionService,
  ) {}

  @Get('inbox')
  getInbox(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query() query: UnifiedCrmInboxQuery & { teamId?: string },
  ) {
    return this.unifiedCrmInboxService.getInbox(
      this.resolveScope(user, query.teamId),
      query,
    );
  }

  @Get('outreach-queue')
  @RequireRoles(UserRole.TEAM_ADMIN)
  listOutreachQueue(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query() query: CrmOutreachQueueQuery,
  ) {
    return this.outreachQueueService.listOutreachQueue(
      this.resolveScope(user),
      query,
    );
  }

  @Post('outreach-queue/:id/dry-run')
  @RequireRoles(UserRole.TEAM_ADMIN)
  dryRunOutreachQueueItem(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.outreachQueueService.dryRunOutreach(
      this.resolveScope(user),
      id,
    );
  }

  @Get('outreach-dispatch/metrics')
  @RequireRoles(UserRole.TEAM_ADMIN)
  getOutreachDispatchMetrics(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.outreachQueueService.getDispatchMetrics(
      this.resolveScope(user),
    );
  }

  @Get('kloser/health')
  @RequireRoles(UserRole.TEAM_ADMIN)
  getKloserHealth(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.kloserMissionService.getHealth(this.resolveScope(user));
  }

  @Get('kloser/metrics')
  @RequireRoles(UserRole.TEAM_ADMIN)
  getKloserMetrics(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.kloserMissionService.getMetrics(this.resolveScope(user));
  }

  @Post('outreach-queue/:id/requeue')
  @RequireRoles(UserRole.TEAM_ADMIN)
  requeueOutreachQueueItem(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.outreachQueueService.requeueOutreach(
      this.resolveScope(user),
      id,
    );
  }

  private resolveScope(user: AuthenticatedUser, explicitTeamId?: string) {
    const workspaceId = user.workspaceId;
    const teamId =
      user.role === UserRole.SUPER_ADMIN
        ? (explicitTeamId ?? user.teamId)
        : user.teamId;

    if (!workspaceId || !teamId) {
      throw new BadRequestException({
        code: 'TEAM_SCOPE_REQUIRED',
        message: 'A workspace and team scope are required for this operation.',
      });
    }

    return {
      workspaceId,
      teamId,
    };
  }
}
