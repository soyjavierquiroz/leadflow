import { Module } from '@nestjs/common';
import { ActionContextSyncService } from './action-context-sync.service';
import { RuntimeContextConfigSyncService } from './runtime-context-config-sync.service';
import { RuntimeContextCentralService } from './runtime-context-central.service';
import { OwnershipContextUpsertService } from './ownership-context-upsert.service';

@Module({
  providers: [
    ActionContextSyncService,
    RuntimeContextCentralService,
    RuntimeContextConfigSyncService,
    OwnershipContextUpsertService,
  ],
  exports: [
    ActionContextSyncService,
    RuntimeContextCentralService,
    RuntimeContextConfigSyncService,
    OwnershipContextUpsertService,
  ],
})
export class RuntimeContextModule {}
