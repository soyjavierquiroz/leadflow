import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { CreateTeamAdWheelDto } from './dto/create-team-ad-wheel.dto';
import type { UpdateTeamAdWheelDto } from './dto/update-team-ad-wheel.dto';
import type { UpsertTeamAdWheelParticipantDto } from './dto/upsert-team-ad-wheel-participant.dto';
import { AdWheelsService } from './ad-wheels.service';

@Controller()
export class AdWheelsController {
  constructor(private readonly adWheelsService: AdWheelsService) {}

  @Get('team/wheels')
  @RequireRoles(UserRole.TEAM_ADMIN)
  listForTeam(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.adWheelsService.listForTeam({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
    });
  }

  @Post('team/wheels')
  @RequireRoles(UserRole.TEAM_ADMIN)
  create(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamAdWheelDto,
  ) {
    return this.adWheelsService.createForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      dto,
    );
  }

  @Patch('team/wheels/:id')
  @RequireRoles(UserRole.TEAM_ADMIN)
  update(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') wheelId: string,
    @Body() dto: UpdateTeamAdWheelDto,
  ) {
    return this.adWheelsService.updateForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      wheelId,
      dto,
    );
  }

  @Post('team/wheels/:id/participants')
  @RequireRoles(UserRole.TEAM_ADMIN)
  upsertParticipant(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') wheelId: string,
    @Body() dto: UpsertTeamAdWheelParticipantDto,
  ) {
    return this.adWheelsService.upsertParticipantForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      wheelId,
      dto,
    );
  }

  @Get('sponsors/me/wheels/active')
  @RequireRoles(UserRole.MEMBER)
  getActiveForSponsor(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.adWheelsService.getActiveForSponsor({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }

  @Post('sponsors/me/wheels/:wheelId/join')
  @RequireRoles(UserRole.MEMBER)
  join(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('wheelId') wheelId: string,
  ) {
    return this.adWheelsService.joinForSponsor(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      wheelId,
    );
  }
}
