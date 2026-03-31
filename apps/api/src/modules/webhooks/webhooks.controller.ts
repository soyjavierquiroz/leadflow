import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { LeadsService } from '../leads/leads.service';
import { SystemApiGuard } from './system-api.guard';

@Controller('webhooks/n8n')
export class WebhooksController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('leads/:id/auto-accept')
  @HttpCode(200)
  @UseGuards(SystemApiGuard)
  autoAcceptLead(@Param('id') leadId: string) {
    return this.leadsService.autoAcceptLeadFromWebhook(leadId);
  }
}
