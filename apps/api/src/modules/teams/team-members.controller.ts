import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { AuthService } from '../auth/auth.service';
import type { AuthRequest, AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { CreateTeamMemberDto } from './dto/create-team-member.dto';
import type { UpdateTeamMemberStatusDto } from './dto/update-team-member-status.dto';
import { TeamMembersService } from './team-members.service';

@Controller('team/members')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class TeamMembersController {
  constructor(
    private readonly teamMembersService: TeamMembersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  findAll(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('teamId') teamId?: string,
  ) {
    return this.teamMembersService.list(this.resolveScope(user, teamId));
  }

  @Get('seat-summary')
  getSeatSummary(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('teamId') teamId?: string,
  ) {
    return this.teamMembersService.getSeatSummary(
      this.resolveScope(user, teamId),
    );
  }

  @Post()
  create(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamMemberDto,
    @Query('teamId') teamId?: string,
  ) {
    return this.teamMembersService.invite(this.resolveScope(user, teamId), dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') memberId: string,
    @Body() dto: UpdateTeamMemberStatusDto,
    @Query('teamId') teamId?: string,
  ) {
    return this.teamMembersService.updateStatus(
      this.resolveScope(user, teamId),
      memberId,
      dto,
    );
  }

  @Delete(':id')
  remove(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') memberId: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.teamMembersService.remove(
      this.resolveScope(user, teamId),
      memberId,
    );
  }

  @Post(':id/impersonate')
  @RequireRoles(UserRole.TEAM_ADMIN)
  async impersonate(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') memberId: string,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const scope = this.resolveScope(user);
    const result = await this.authService.impersonate({
      targetUserId: memberId,
      impersonator: user,
      userAgent: request.headers['user-agent'] ?? null,
      ipAddress: request.ip ?? null,
      requiredWorkspaceId: scope.workspaceId,
      requiredTeamId: scope.teamId,
      allowedTargetRoles: [UserRole.MEMBER],
    });

    this.authService.setSessionCookie(reply, result.sessionToken);

    return {
      success: true,
      message: 'Impersonation session started successfully.',
      redirectPath: result.user.homePath,
      user: result.user,
    };
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
