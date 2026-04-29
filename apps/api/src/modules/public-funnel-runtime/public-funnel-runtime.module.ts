import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { MailModule } from '../mail/mail.module';
import { MessagingAutomationModule } from '../messaging-automation/messaging-automation.module';
import { SystemApiGuard } from '../webhooks/system-api.guard';
import { LeadCaptureAssignmentService } from './lead-capture-assignment.service';
import { IdentityTokenService } from './identity-token.service';
import { PublicIdentityLinkService } from './public-identity-link.service';
import { PublicTrackedLinksController } from './public-tracked-links.controller';
import { PublicFunnelRuntimeController } from './public-funnel-runtime.controller';
import { PublicFunnelRuntimeService } from './public-funnel-runtime.service';
import { PublicRuntimeController } from './public-runtime.controller';
import { PublicRuntimeService } from './public-runtime.service';
import { ShortLinkProvider } from './short-link.provider';

@Module({
  imports: [EventsModule, MessagingAutomationModule, MailModule],
  controllers: [
    PublicFunnelRuntimeController,
    PublicRuntimeController,
    PublicTrackedLinksController,
  ],
  providers: [
    PublicFunnelRuntimeService,
    PublicRuntimeService,
    LeadCaptureAssignmentService,
    IdentityTokenService,
    ShortLinkProvider,
    PublicIdentityLinkService,
    SystemApiGuard,
  ],
  exports: [
    PublicFunnelRuntimeService,
    PublicRuntimeService,
    LeadCaptureAssignmentService,
    IdentityTokenService,
    PublicIdentityLinkService,
  ],
})
export class PublicFunnelRuntimeModule {}
