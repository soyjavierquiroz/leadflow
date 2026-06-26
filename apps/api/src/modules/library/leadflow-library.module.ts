import { Module } from '@nestjs/common';
import { LeadflowLibraryController } from './leadflow-library.controller';
import { LeadflowLibraryService } from './leadflow-library.service';

@Module({
  controllers: [LeadflowLibraryController],
  providers: [LeadflowLibraryService],
  exports: [LeadflowLibraryService],
})
export class LeadflowLibraryModule {}
