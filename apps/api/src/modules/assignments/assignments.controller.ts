import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { AssignmentsService } from './assignments.service';

@Controller('assignments')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.MEMBER)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  findAll(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('sponsorId') sponsorId?: string,
    @Query('funnelPublicationId') funnelPublicationId?: string,
  ) {
    return this.assignmentsService.list({
      workspaceId:
        user.role === UserRole.SUPER_ADMIN
          ? (workspaceId ?? user.workspaceId ?? undefined)
          : user.role === UserRole.TEAM_ADMIN
            ? (user.workspaceId ?? undefined)
            : undefined,
      teamId:
        user.role === UserRole.TEAM_ADMIN
          ? (user.teamId ?? undefined)
          : undefined,
      sponsorId:
        user.role === UserRole.MEMBER
          ? (user.sponsorId ?? undefined)
          : sponsorId,
      funnelPublicationId,
    });
  }
}
