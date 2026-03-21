import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { MessagingAutomationService } from './messaging-automation.service';

@Controller('messaging-automation')
@RequireRoles(UserRole.MEMBER)
export class MessagingAutomationController {
  constructor(
    private readonly messagingAutomationService: MessagingAutomationService,
  ) {}

  @Get('me')
  getMemberSnapshot(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.messagingAutomationService.getMemberSnapshot({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }
}
