import { Module } from '@nestjs/common';
import { RuntimeContextModule } from '../runtime-context/runtime-context.module';
import { HybridFunnelPublicationsController } from './hybrid-funnel-publications.controller';
import { HybridFunnelPublicationsService } from './hybrid-funnel-publications.service';
import { SystemHybridFunnelPublicationsController } from './system-hybrid-funnel-publications.controller';

@Module({
  imports: [RuntimeContextModule],
  controllers: [
    HybridFunnelPublicationsController,
    SystemHybridFunnelPublicationsController,
  ],
  providers: [HybridFunnelPublicationsService],
  exports: [HybridFunnelPublicationsService],
})
export class HybridFunnelPublicationsModule {}
