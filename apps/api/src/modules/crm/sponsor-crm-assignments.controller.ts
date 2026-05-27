import { BadRequestException, Controller, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { CrmAssignmentService } from './crm-assignment.service';

@Controller('sponsors/me/crm/assignments')
@RequireRoles(UserRole.MEMBER)
export class SponsorCrmAssignmentsController {
  constructor(private readonly crmAssignmentService: CrmAssignmentService) {}

  @Post(':id/accept')
  acceptAssignment(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') assignmentId: string,
  ) {
    if (!user.workspaceId || !user.teamId || !user.sponsorId) {
      throw new BadRequestException({
        code: 'SPONSOR_SCOPE_REQUIRED',
        message: 'A sponsor workspace and team scope are required.',
      });
    }

    return this.crmAssignmentService.acceptAssignment({
      workspaceId: user.workspaceId,
      teamId: user.teamId,
      sponsorId: user.sponsorId,
      assignmentId,
    });
  }
}
