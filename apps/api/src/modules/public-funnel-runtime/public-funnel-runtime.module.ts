import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { MessagingAutomationModule } from '../messaging-automation/messaging-automation.module';
import { LeadCaptureAssignmentService } from './lead-capture-assignment.service';
import { PublicFunnelRuntimeController } from './public-funnel-runtime.controller';
import { PublicFunnelRuntimeService } from './public-funnel-runtime.service';
import { PublicRuntimeController } from './public-runtime.controller';
import { PublicRuntimeService } from './public-runtime.service';

@Module({
  imports: [EventsModule, MessagingAutomationModule],
  controllers: [PublicFunnelRuntimeController, PublicRuntimeController],
  providers: [
    PublicFunnelRuntimeService,
    PublicRuntimeService,
    LeadCaptureAssignmentService,
  ],
  exports: [
    PublicFunnelRuntimeService,
    PublicRuntimeService,
    LeadCaptureAssignmentService,
  ],
})
export class PublicFunnelRuntimeModule {}
