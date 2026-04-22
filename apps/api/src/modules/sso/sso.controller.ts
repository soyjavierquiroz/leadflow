import { Controller, Get } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireOperationalMemberAccess } from '../auth/roles.decorator';
import { SsoService } from './sso.service';

@Controller('sso')
@RequireOperationalMemberAccess()
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('blacklist')
  getBlacklistUrl(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.ssoService.buildBlacklistUrl(user);
  }
}
