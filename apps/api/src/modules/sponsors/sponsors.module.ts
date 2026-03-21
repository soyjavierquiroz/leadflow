import { Module } from '@nestjs/common';
import { SponsorsService } from './sponsors.service';

@Module({
  providers: [SponsorsService],
  exports: [SponsorsService],
})
export class SponsorsModule {}
