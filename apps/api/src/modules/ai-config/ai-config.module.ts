import { Module } from '@nestjs/common';
import { WalletEngineModule } from '../finance/wallet-engine.module';
import { AiConfigController } from './ai-config.controller';
import { AiConfigInternalApiGuard } from './ai-config-internal-api.guard';
import { AiConfigMemberController } from './ai-config-member.controller';
import { AiConfigService } from './ai-config.service';
import { TenantConfigCacheService } from './tenant-config-cache.service';

@Module({
  imports: [WalletEngineModule],
  controllers: [AiConfigController, AiConfigMemberController],
  providers: [
    AiConfigService,
    AiConfigInternalApiGuard,
    TenantConfigCacheService,
  ],
  exports: [AiConfigService],
})
export class AiConfigModule {}
