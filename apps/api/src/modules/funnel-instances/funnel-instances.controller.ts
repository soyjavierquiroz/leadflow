import { Controller, Get, Query } from '@nestjs/common';
import { FunnelInstancesService } from './funnel-instances.service';

@Controller('funnel-instances')
export class FunnelInstancesController {
  constructor(
    private readonly funnelInstancesService: FunnelInstancesService,
  ) {}

  @Get()
  findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.funnelInstancesService.list({ workspaceId, teamId });
  }
}
