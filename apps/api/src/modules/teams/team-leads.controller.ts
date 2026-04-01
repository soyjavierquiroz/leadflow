import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { ReassignTeamLeadDto } from './dto/reassign-team-lead.dto';
import { TeamLeadsService } from './team-leads.service';

@Controller('team/leads')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class TeamLeadsController {
  constructor(private readonly teamLeadsService: TeamLeadsService) {}

  @Get()
  findAll(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('teamId') teamId?: string,
  ) {
    return this.teamLeadsService.list(this.resolveScope(user, teamId));
  }

  @Patch(':id/reassign')
  reassign(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') leadId: string,
    @Body() dto: ReassignTeamLeadDto,
    @Query('teamId') teamId?: string,
  ) {
    return this.teamLeadsService.reassign(
      this.resolveScope(user, teamId),
      leadId,
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
