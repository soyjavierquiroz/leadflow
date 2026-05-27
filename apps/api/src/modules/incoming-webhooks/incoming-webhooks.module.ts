import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { KloserModule } from '../kloser/kloser.module';
import { IncomingWebhooksController } from './incoming-webhooks.controller';
import { IncomingWebhooksService } from './incoming-webhooks.service';

@Module({
  imports: [KloserModule, CrmModule],
  controllers: [IncomingWebhooksController],
  providers: [IncomingWebhooksService],
  exports: [IncomingWebhooksService],
})
export class IncomingWebhooksModule {}
