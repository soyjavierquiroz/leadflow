import { Module } from '@nestjs/common';
import { MessagingAutomationController } from './messaging-automation.controller';
import { N8nAutomationClient } from './n8n-automation.client';
import { MessagingAutomationService } from './messaging-automation.service';

@Module({
  controllers: [MessagingAutomationController],
  providers: [MessagingAutomationService, N8nAutomationClient],
  exports: [MessagingAutomationService],
})
export class MessagingAutomationModule {}
