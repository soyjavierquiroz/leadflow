import { Body, Controller, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { CreateTeamAdWheelDto } from './dto/create-team-ad-wheel.dto';
import { AdWheelsService } from './ad-wheels.service';

@Controller()
export class AdWheelsController {
  constructor(private readonly adWheelsService: AdWheelsService) {}

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
