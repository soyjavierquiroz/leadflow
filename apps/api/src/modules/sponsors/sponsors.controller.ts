import { Controller, Get, Query } from '@nestjs/common';
import { SponsorsService } from './sponsors.service';

@Controller('sponsors')
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Get()
  findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.sponsorsService.list({ workspaceId, teamId });
  }
}
