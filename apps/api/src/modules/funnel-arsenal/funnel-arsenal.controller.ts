import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireOperationalMemberAccess } from '../auth/roles.decorator';
import { FunnelArsenalService } from './funnel-arsenal.service';

@Controller('funnel-arsenal')
export class FunnelArsenalController {
  constructor(private readonly funnelArsenalService: FunnelArsenalService) {}

  @Get('me')
  @RequireOperationalMemberAccess()
  listMine(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.funnelArsenalService.listForCurrentTeam(user);
  }

  @Get('me/:assetSlug/preview')
  @RequireOperationalMemberAccess()
  previewMine(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('assetSlug') assetSlug: string,
    @Query('step') stepSlug?: string,
  ) {
    return this.funnelArsenalService.getPreviewRuntimeForCurrentTeam(
      user,
      assetSlug,
      stepSlug,
    );
  }

  @Get('me/:assetSlug')
  @RequireOperationalMemberAccess()
  getMine(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('assetSlug') assetSlug: string,
  ) {
    return this.funnelArsenalService.getTemplateForCurrentTeam(user, assetSlug);
  }

  @Post('me/:templateKey/enable')
  @RequireOperationalMemberAccess()
  enableMine(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('templateKey') templateKey: string,
  ) {
    return this.funnelArsenalService.enableForCurrentTeam(user, templateKey);
  }
}
