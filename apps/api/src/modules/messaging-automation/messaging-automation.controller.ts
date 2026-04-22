import { Controller, Get } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireOperationalMemberAccess } from '../auth/roles.decorator';
import { MessagingAutomationService } from './messaging-automation.service';

@Controller('messaging-automation')
@RequireOperationalMemberAccess()
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
