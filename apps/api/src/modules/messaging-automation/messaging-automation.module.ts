import { Module } from '@nestjs/common';
import { LeadDispatcherService } from './lead-dispatcher.service';
import { MessagingAutomationController } from './messaging-automation.controller';
import { N8nAutomationClient } from './n8n-automation.client';
import { MessagingAutomationService } from './messaging-automation.service';
import { RuntimeContextModule } from '../runtime-context/runtime-context.module';

@Module({
  imports: [RuntimeContextModule],
  controllers: [MessagingAutomationController],
  providers: [
    MessagingAutomationService,
    N8nAutomationClient,
    LeadDispatcherService,
  ],
  exports: [MessagingAutomationService, LeadDispatcherService],
})
export class MessagingAutomationModule {}
