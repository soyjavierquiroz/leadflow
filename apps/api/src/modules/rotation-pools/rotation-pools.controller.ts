import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { CreateRotationPoolDto } from './dto/create-rotation-pool.dto';
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

  @Post()
  @RequireRoles(UserRole.TEAM_ADMIN)
  create(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: CreateRotationPoolDto,
  ) {
    return this.rotationPoolsService.createForScope(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      {
        name: dto.name,
        strategy: dto.strategy,
        sponsorIds: dto.sponsorIds,
        funnelIds: dto.funnelIds,
        isFallbackPool: dto.isFallbackPool,
        status: dto.status,
      },
    );
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

  @Delete('members/:memberId')
  @RequireRoles(UserRole.TEAM_ADMIN)
  removeMember(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
  ) {
    return this.rotationPoolsService.deleteMemberForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      memberId,
    );
  }
}
