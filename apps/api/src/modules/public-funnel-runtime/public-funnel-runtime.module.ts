import { Module } from '@nestjs/common';
import { PublicFunnelRuntimeController } from './public-funnel-runtime.controller';
import { PublicFunnelRuntimeService } from './public-funnel-runtime.service';

@Module({
  controllers: [PublicFunnelRuntimeController],
  providers: [PublicFunnelRuntimeService],
  exports: [PublicFunnelRuntimeService],
})
export class PublicFunnelRuntimeModule {}
