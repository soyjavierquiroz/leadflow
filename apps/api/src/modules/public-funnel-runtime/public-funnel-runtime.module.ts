import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { MessagingAutomationModule } from '../messaging-automation/messaging-automation.module';
import { LeadCaptureAssignmentService } from './lead-capture-assignment.service';
import { PublicFunnelRuntimeController } from './public-funnel-runtime.controller';
import { PublicFunnelRuntimeService } from './public-funnel-runtime.service';

@Module({
  imports: [EventsModule, MessagingAutomationModule],
  controllers: [PublicFunnelRuntimeController],
  providers: [PublicFunnelRuntimeService, LeadCaptureAssignmentService],
  exports: [PublicFunnelRuntimeService, LeadCaptureAssignmentService],
})
export class PublicFunnelRuntimeModule {}
