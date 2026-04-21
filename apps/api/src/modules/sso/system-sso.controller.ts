import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RequireRoles } from '../auth/roles.decorator';
import { SsoService } from './sso.service';

@Controller('system/sso')
@RequireRoles(UserRole.SUPER_ADMIN)
export class SystemSsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('blacklist-admin')
  getAdminBlacklistUrl() {
    return this.ssoService.buildAdminBlacklistUrl();
  }
}
