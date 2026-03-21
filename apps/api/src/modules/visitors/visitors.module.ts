import { Module } from '@nestjs/common';
import { VisitorsService } from './visitors.service';

@Module({
  providers: [VisitorsService],
  exports: [VisitorsService],
})
export class VisitorsModule {}
