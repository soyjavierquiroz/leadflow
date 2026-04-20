import { Module } from '@nestjs/common';
import { KurukinBlacklistController } from './kurukin-blacklist.controller';
import { KurukinBlacklistService } from './kurukin-blacklist.service';

@Module({
  controllers: [KurukinBlacklistController],
  providers: [KurukinBlacklistService],
  exports: [KurukinBlacklistService],
})
export class KurukinBlacklistModule {}
