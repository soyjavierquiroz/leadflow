import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SystemApiGuard } from '../webhooks/system-api.guard';
import type { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { TeamsService } from './teams.service';

@Controller('system')
@UseGuards(SystemApiGuard)
export class SystemTeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post('provision-tenant')
  provisionTenant(@Body() dto: ProvisionTenantDto) {
    return this.teamsService.provisionTenant(dto);
  }
}
