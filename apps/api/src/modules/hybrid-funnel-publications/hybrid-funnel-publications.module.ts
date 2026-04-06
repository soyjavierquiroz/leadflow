import { Module } from '@nestjs/common';
import { HybridFunnelPublicationsController } from './hybrid-funnel-publications.controller';
import { HybridFunnelPublicationsService } from './hybrid-funnel-publications.service';
import { SystemHybridFunnelPublicationsController } from './system-hybrid-funnel-publications.controller';

@Module({
  controllers: [
    HybridFunnelPublicationsController,
    SystemHybridFunnelPublicationsController,
  ],
  providers: [HybridFunnelPublicationsService],
  exports: [HybridFunnelPublicationsService],
})
export class HybridFunnelPublicationsModule {}
