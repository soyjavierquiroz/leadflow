import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { HandoffStrategiesService } from './handoff-strategies.service';

@Controller('handoff-strategies')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class HandoffStrategiesController {
  constructor(
    private readonly handoffStrategiesService: HandoffStrategiesService,
  ) {}

  @Get('presets')
  findPresets() {
    return this.handoffStrategiesService.listPresets();
  }

  @Get()
  findAll(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.handoffStrategiesService.list({
      workspaceId:
        user.role === UserRole.SUPER_ADMIN
          ? (workspaceId ?? user.workspaceId ?? undefined)
          : (user.workspaceId ?? undefined),
      teamId:
        user.role === UserRole.SUPER_ADMIN
          ? teamId
          : (user.teamId ?? undefined),
    });
  }
}
