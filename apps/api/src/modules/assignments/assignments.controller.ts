import { Controller, Get, Query } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('sponsorId') sponsorId?: string,
    @Query('funnelPublicationId') funnelPublicationId?: string,
  ) {
    return this.assignmentsService.list({
      workspaceId,
      sponsorId,
      funnelPublicationId,
    });
  }
}
