import { Module } from '@nestjs/common';
import { CommercialProfileModule } from '../commercial-profile/commercial-profile.module';
import { FunnelArsenalController } from './funnel-arsenal.controller';
import { FunnelArsenalService } from './funnel-arsenal.service';

@Module({
  imports: [CommercialProfileModule],
  controllers: [FunnelArsenalController],
  providers: [FunnelArsenalService],
  exports: [FunnelArsenalService],
})
export class FunnelArsenalModule {}
