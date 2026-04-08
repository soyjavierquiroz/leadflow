import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { UpdateTeamSettingsDto } from './dto/update-team-settings.dto';
import { TeamsService } from './teams.service';

@Controller('team/settings')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class TeamSettingsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  getSettings(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('teamId') teamId?: string,
  ) {
    return this.teamsService.getTeamSettings(this.resolveScope(user, teamId));
  }

  @Patch()
  updateSettings(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: UpdateTeamSettingsDto,
    @Query('teamId') teamId?: string,
  ) {
    return this.teamsService.updateTeamSettings(
      this.resolveScope(user, teamId),
      dto,
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
