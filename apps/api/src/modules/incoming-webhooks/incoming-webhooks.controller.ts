import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { IncomingWebhooksService } from './incoming-webhooks.service';
import { redactSensitiveData } from '../shared/redact-sensitive-data';

@Controller('incoming-webhooks')
export class IncomingWebhooksController {
  private readonly logger = new Logger(IncomingWebhooksController.name);

  constructor(
    private readonly incomingWebhooksService: IncomingWebhooksService,
  ) {}

  @Post('messaging/connection')
  @HttpCode(202)
  receiveMessagingConnection(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('instanceId') instanceId?: string,
    @Query('secret') secret?: string,
    @Body() payload?: unknown,
  ) {
    this.logger.log(
      `Evolution inbound webhook attempt: headers=${this.stringifyForLogs(
        headers,
      )} query=${this.stringifyForLogs({
        instanceId: instanceId ?? null,
        secret: secret ?? null,
      })} body=${this.stringifyForLogs(payload)}`,
    );

    return this.incomingWebhooksService.ingestMessagingConnection(
      headers,
      {
        instanceId,
        secret,
      },
      payload,
    );
  }

  @Post('messaging')
  @HttpCode(202)
  receiveMessagingSignal(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('instanceId') instanceId?: string,
    @Query('secret') secret?: string,
    @Body() payload?: unknown,
  ) {
    this.logger.log(
      `Inbound messaging signal attempt: headers=${this.stringifyForLogs(
        headers,
      )} query=${this.stringifyForLogs({
        instanceId: instanceId ?? null,
        secret: secret ?? null,
      })} body=${this.stringifyForLogs(payload)}`,
    );

    return this.incomingWebhooksService.ingestMessagingSignal(
      headers,
      {
        instanceId,
        secret,
      },
      payload,
    );
  }

  private stringifyForLogs(value: unknown) {
    try {
      return JSON.stringify(redactSensitiveData(value));
    } catch {
      return '[unserializable payload]';
    }
  }
}
