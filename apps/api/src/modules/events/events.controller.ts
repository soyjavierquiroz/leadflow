import { Controller, Get, Query } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('leadId') leadId?: string,
    @Query('funnelPublicationId') funnelPublicationId?: string,
  ) {
    return this.eventsService.list({
      workspaceId,
      leadId,
      funnelPublicationId,
    });
  }
}
