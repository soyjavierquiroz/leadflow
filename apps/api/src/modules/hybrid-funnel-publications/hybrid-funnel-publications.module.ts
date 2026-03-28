import { Module } from '@nestjs/common';
import { HybridFunnelPublicationsController } from './hybrid-funnel-publications.controller';
import { HybridFunnelPublicationsService } from './hybrid-funnel-publications.service';

@Module({
  controllers: [HybridFunnelPublicationsController],
  providers: [HybridFunnelPublicationsService],
  exports: [HybridFunnelPublicationsService],
})
export class HybridFunnelPublicationsModule {}
