import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { UpdateRotationMemberDto } from './dto/update-rotation-member.dto';
import { RotationPoolsService } from './rotation-pools.service';

@Controller('rotation-pools')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class RotationPoolsController {
  constructor(private readonly rotationPoolsService: RotationPoolsService) {}

  @Get()
  findAll(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.rotationPoolsService.list({
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

  @Get('members')
  @RequireRoles(UserRole.TEAM_ADMIN)
  findMembers(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('rotationPoolId') rotationPoolId?: string,
  ) {
    return this.rotationPoolsService.listMembers({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      rotationPoolId,
    });
  }

  @Patch('members/:memberId')
  @RequireRoles(UserRole.TEAM_ADMIN)
  updateMember(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateRotationMemberDto,
  ) {
    return this.rotationPoolsService.updateMemberForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      memberId,
      dto,
    );
  }
}
