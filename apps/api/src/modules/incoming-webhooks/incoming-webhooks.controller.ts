import { Body, Controller, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { IncomingWebhooksService } from './incoming-webhooks.service';

@Controller('incoming-webhooks')
export class IncomingWebhooksController {
  constructor(
    private readonly incomingWebhooksService: IncomingWebhooksService,
  ) {}

  @Post('messaging/connection')
  @HttpCode(202)
  receiveMessagingConnection(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('instanceId') instanceId?: string,
    @Query('secret') secret?: string,
    @Body() payload?: Record<string, unknown>,
  ) {
    return this.incomingWebhooksService.ingestMessagingConnection(
      headers,
      {
        instanceId,
        secret,
      },
      payload,
    );
  }
}
