import { Module } from '@nestjs/common';
import { LeadCaptureAssignmentService } from './lead-capture-assignment.service';
import { PublicFunnelRuntimeController } from './public-funnel-runtime.controller';
import { PublicFunnelRuntimeService } from './public-funnel-runtime.service';

@Module({
  controllers: [PublicFunnelRuntimeController],
  providers: [PublicFunnelRuntimeService, LeadCaptureAssignmentService],
  exports: [PublicFunnelRuntimeService, LeadCaptureAssignmentService],
})
export class PublicFunnelRuntimeModule {}
