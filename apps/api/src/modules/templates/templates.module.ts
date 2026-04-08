import { Module } from '@nestjs/common';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
  controllers: [TemplateController],
  providers: [TemplateService, SystemTenantAccessGuard],
  exports: [TemplateService],
})
export class TemplatesModule {}
