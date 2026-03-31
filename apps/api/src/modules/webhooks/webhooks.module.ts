import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { SystemApiGuard } from './system-api.guard';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [LeadsModule],
  controllers: [WebhooksController],
  providers: [SystemApiGuard],
})
export class WebhooksModule {}
