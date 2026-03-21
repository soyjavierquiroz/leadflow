import { Controller, Get, Query } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@Query('workspaceId') workspaceId?: string) {
    return this.leadsService.list(workspaceId);
  }
}
