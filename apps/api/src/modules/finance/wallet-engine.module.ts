import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WalletEngineService } from './wallet-engine.service';

@Module({
  imports: [HttpModule],
  providers: [WalletEngineService],
  exports: [WalletEngineService],
})
export class WalletEngineModule {}
