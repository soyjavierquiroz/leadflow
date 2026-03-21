import { Module } from '@nestjs/common';
import { FunnelsService } from './funnels.service';

@Module({
  providers: [FunnelsService],
  exports: [FunnelsService],
})
export class FunnelsModule {}
