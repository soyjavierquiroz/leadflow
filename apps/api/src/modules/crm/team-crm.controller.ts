import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { UnifiedCrmInboxService } from './unified-crm-inbox.service';
import type { UnifiedCrmInboxQuery } from './unified-crm.types';

@Controller('team/crm')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class TeamCrmController {
  constructor(private readonly unifiedCrmInboxService: UnifiedCrmInboxService) {}

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

