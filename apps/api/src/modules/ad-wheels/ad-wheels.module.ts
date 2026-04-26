import { Module } from '@nestjs/common';
import { WalletEngineModule } from '../finance/wallet-engine.module';
import { AdWheelSequenceGeneratorService } from './ad-wheel-sequence-generator.service';
import { AdWheelsController } from './ad-wheels.controller';
import { AdWheelsService } from './ad-wheels.service';

@Module({
  imports: [WalletEngineModule],
  controllers: [AdWheelsController],
  providers: [AdWheelsService, AdWheelSequenceGeneratorService],
  exports: [AdWheelsService, AdWheelSequenceGeneratorService],
})
export class AdWheelsModule {}
