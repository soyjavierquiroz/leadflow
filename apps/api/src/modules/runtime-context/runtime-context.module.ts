import { Module } from '@nestjs/common';
import { RuntimeContextConfigSyncService } from './runtime-context-config-sync.service';
import { RuntimeContextCentralService } from './runtime-context-central.service';

@Module({
  providers: [RuntimeContextCentralService, RuntimeContextConfigSyncService],
  exports: [RuntimeContextCentralService, RuntimeContextConfigSyncService],
})
export class RuntimeContextModule {}
