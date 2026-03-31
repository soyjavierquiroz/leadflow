import { Module } from '@nestjs/common';
import { MessagingIntegrationsController } from './messaging-integrations.controller';
import { EvolutionApiClient } from './evolution-api.client';
import { MessagingIntegrationsService } from './messaging-integrations.service';
import { RuntimeContextModule } from '../runtime-context/runtime-context.module';

@Module({
  imports: [RuntimeContextModule],
  controllers: [MessagingIntegrationsController],
  providers: [MessagingIntegrationsService, EvolutionApiClient],
  exports: [MessagingIntegrationsService],
})
export class MessagingIntegrationsModule {}
