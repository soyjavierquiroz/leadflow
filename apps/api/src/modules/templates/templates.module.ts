import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
  imports: [StorageModule],
  controllers: [TemplateController],
  providers: [TemplateService, SystemTenantAccessGuard],
  exports: [TemplateService],
})
export class TemplatesModule {}
