import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { UpdateMemberSponsorDto } from './dto/update-member-sponsor.dto';
import type { UpdateTeamSponsorDto } from './dto/update-team-sponsor.dto';
import { SponsorsService } from './sponsors.service';

@Controller('sponsors')
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Get()
  @RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
  findAll(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.sponsorsService.list({
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

  @Get('me')
  @RequireRoles(UserRole.MEMBER)
  findMe(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.sponsorsService.findForMember({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }

  @Patch('me')
  @RequireRoles(UserRole.MEMBER)
  updateMe(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberSponsorDto,
  ) {
    return this.sponsorsService.updateForMember(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      dto,
    );
  }

  @Patch(':id')
  @RequireRoles(UserRole.TEAM_ADMIN)
  update(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') sponsorId: string,
    @Body() dto: UpdateTeamSponsorDto,
  ) {
    return this.sponsorsService.updateForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      sponsorId,
      dto,
    );
  }
}
