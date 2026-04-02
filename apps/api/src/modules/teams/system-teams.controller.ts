import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { SystemTenantAccessGuard } from './system-tenant-access.guard';
import { TeamsService } from './teams.service';

@Controller('system')
@UseGuards(SystemTenantAccessGuard)
export class SystemTeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get('tenants')
  listTenants() {
    return this.teamsService.listSystemTenants();
  }

  @Get('tenants/:id')
  getTenantDetail(@Param('id') id: string) {
    return this.teamsService.getSystemTenantDetail(id);
  }

  @Get('tenants/:id/funnels')
  listTenantFunnels(@Param('id') id: string) {
    return this.teamsService.listSystemTenantFunnels(id);
  }

  @Post('provision-tenant')
  provisionTenant(@Body() dto: ProvisionTenantDto) {
    return this.teamsService.provisionTenant(dto);
  }
}
