import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { SsoService } from './sso.service';

@Controller('sso')
@RequireRoles(UserRole.MEMBER)
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('blacklist')
  getBlacklistUrl(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.ssoService.buildBlacklistUrl(user);
  }
}
