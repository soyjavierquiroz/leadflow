import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { ReceiveMessagingSignalDto } from './dto/receive-messaging-signal.dto';
import { IncomingWebhooksService } from './incoming-webhooks.service';

@Controller('incoming-webhooks')
export class IncomingWebhooksController {
  constructor(
    private readonly incomingWebhooksService: IncomingWebhooksService,
  ) {}

  @Post('messaging')
  @HttpCode(202)
  receiveMessagingSignal(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: ReceiveMessagingSignalDto,
  ) {
    return this.incomingWebhooksService.ingestMessagingSignal(headers, dto);
  }

  @Get('messaging/signals')
  @RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN, UserRole.MEMBER)
  listLeadSignals(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('leadId') leadId: string,
    @Query('limit') limit?: string,
  ) {
    return this.incomingWebhooksService.listLeadSignals(user, leadId, limit);
  }
}
