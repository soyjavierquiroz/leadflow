import { Module } from '@nestjs/common';
import { RotationPoolsService } from './rotation-pools.service';

@Module({
  providers: [RotationPoolsService],
  exports: [RotationPoolsService],
})
export class RotationPoolsModule {}
