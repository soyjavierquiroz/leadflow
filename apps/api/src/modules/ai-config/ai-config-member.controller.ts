import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { UpdateMyAiConfigDto } from './dto/update-my-ai-config.dto';
import { AiConfigService } from './ai-config.service';

@Controller('ai-config')
export class AiConfigMemberController {
  constructor(private readonly aiConfigService: AiConfigService) {}

  @Get('me')
  @RequireRoles(UserRole.TEAM_ADMIN)
  getMySettings(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.aiConfigService.getMemberEditorSnapshot({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }

  @Patch('me')
  @RequireRoles(UserRole.TEAM_ADMIN)
  updateMySettings(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: UpdateMyAiConfigDto,
  ) {
    return this.aiConfigService.updateMemberSettings(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      {
        basePrompt: dto.basePrompt,
        routeContexts: dto.routeContexts,
        defaultCta: dto.defaultCta,
      },
    );
  }
}
