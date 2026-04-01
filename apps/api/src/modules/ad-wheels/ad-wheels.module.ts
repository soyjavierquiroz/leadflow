import { Module } from '@nestjs/common';
import { WalletEngineModule } from '../finance/wallet-engine.module';
import { AdWheelsController } from './ad-wheels.controller';
import { AdWheelsService } from './ad-wheels.service';

@Module({
  imports: [WalletEngineModule],
  controllers: [AdWheelsController],
  providers: [AdWheelsService],
  exports: [AdWheelsService],
})
export class AdWheelsModule {}
