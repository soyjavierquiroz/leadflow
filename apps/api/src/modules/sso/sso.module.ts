import { Module } from '@nestjs/common';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';
import { SystemSsoController } from './system-sso.controller';

@Module({
  controllers: [SsoController, SystemSsoController],
  providers: [SsoService],
  exports: [SsoService],
})
export class SsoModule {}
