import { Controller, Get, Query } from '@nestjs/common';
import { FunnelPublicationsService } from './funnel-publications.service';

@Controller('funnel-publications')
export class FunnelPublicationsController {
  constructor(
    private readonly funnelPublicationsService: FunnelPublicationsService,
  ) {}

  @Get()
  findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
    @Query('domainId') domainId?: string,
  ) {
    return this.funnelPublicationsService.list({
      workspaceId,
      teamId,
      domainId,
    });
  }
}
