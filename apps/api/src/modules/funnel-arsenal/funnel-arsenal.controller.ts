import { Controller, Get, Param, Post } from '@nestjs/common';
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

  @Post('me/:templateKey/enable')
  @RequireOperationalMemberAccess()
  enableMine(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('templateKey') templateKey: string,
  ) {
    return this.funnelArsenalService.enableForCurrentTeam(user, templateKey);
  }
}
