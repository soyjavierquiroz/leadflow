import { Module } from '@nestjs/common';
import { IncomingWebhooksController } from './incoming-webhooks.controller';
import { IncomingWebhooksService } from './incoming-webhooks.service';

@Module({
  controllers: [IncomingWebhooksController],
  providers: [IncomingWebhooksService],
  exports: [IncomingWebhooksService],
})
export class IncomingWebhooksModule {}
