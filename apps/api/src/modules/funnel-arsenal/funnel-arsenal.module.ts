import { Module } from '@nestjs/common';
import { CommercialProfileModule } from '../commercial-profile/commercial-profile.module';
import { FunnelArsenalController } from './funnel-arsenal.controller';
import { FunnelArsenalService } from './funnel-arsenal.service';
import { FunnelMasterClonerService } from './funnel-master-cloner.service';
import { SystemFunnelArsenalController } from './system-funnel-arsenal.controller';

@Module({
  imports: [CommercialProfileModule],
  controllers: [FunnelArsenalController, SystemFunnelArsenalController],
  providers: [FunnelArsenalService, FunnelMasterClonerService],
  exports: [FunnelArsenalService, FunnelMasterClonerService],
})
export class FunnelArsenalModule {}
