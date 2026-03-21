import { Controller, Get, Query } from '@nestjs/common';
import { RotationPoolsService } from './rotation-pools.service';

@Controller('rotation-pools')
export class RotationPoolsController {
  constructor(private readonly rotationPoolsService: RotationPoolsService) {}

  @Get()
  findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.rotationPoolsService.list({ workspaceId, teamId });
  }
}
