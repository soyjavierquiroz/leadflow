import { Module } from '@nestjs/common';
import { RuntimeContextConfigSyncService } from './runtime-context-config-sync.service';
import { RuntimeContextCentralService } from './runtime-context-central.service';
import { OwnershipContextUpsertService } from './ownership-context-upsert.service';

@Module({
  providers: [
    RuntimeContextCentralService,
    RuntimeContextConfigSyncService,
    OwnershipContextUpsertService,
  ],
  exports: [
    RuntimeContextCentralService,
    RuntimeContextConfigSyncService,
    OwnershipContextUpsertService,
  ],
})
export class RuntimeContextModule {}
