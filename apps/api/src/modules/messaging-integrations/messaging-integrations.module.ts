import { Module } from '@nestjs/common';
import { MessagingIntegrationsController } from './messaging-integrations.controller';
import { EvolutionApiClient } from './evolution-api.client';
import { MessagingIntegrationsService } from './messaging-integrations.service';

@Module({
  controllers: [MessagingIntegrationsController],
  providers: [MessagingIntegrationsService, EvolutionApiClient],
  exports: [MessagingIntegrationsService],
})
export class MessagingIntegrationsModule {}
