import { Controller, Get, Query } from '@nestjs/common';
import { FunnelTemplatesService } from './funnel-templates.service';

@Controller('funnel-templates')
export class FunnelTemplatesController {
  constructor(
    private readonly funnelTemplatesService: FunnelTemplatesService,
  ) {}

  @Get()
  findAll(@Query('workspaceId') workspaceId?: string) {
    return this.funnelTemplatesService.list(workspaceId);
  }
}
