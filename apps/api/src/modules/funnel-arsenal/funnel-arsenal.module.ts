import { Module } from '@nestjs/common';
import { CommercialProfileModule } from '../commercial-profile/commercial-profile.module';
import { FunnelArsenalController } from './funnel-arsenal.controller';
import { FunnelArsenalService } from './funnel-arsenal.service';
import { SystemFunnelArsenalController } from './system-funnel-arsenal.controller';

@Module({
  imports: [CommercialProfileModule],
  controllers: [FunnelArsenalController, SystemFunnelArsenalController],
  providers: [FunnelArsenalService],
  exports: [FunnelArsenalService],
})
export class FunnelArsenalModule {}
