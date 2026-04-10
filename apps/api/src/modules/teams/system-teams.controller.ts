import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { CreateSystemTenantDto } from './dto/create-system-tenant.dto';
import type { UpdateSystemTenantFunnelDto } from './dto/update-system-tenant-funnel.dto';
import type { UpdateSystemTenantFunnelStepDto } from './dto/update-system-tenant-funnel-step.dto';
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

  @Get('tenants/:id/funnels/:funnelId')
  getTenantFunnel(
    @Param('id') id: string,
    @Param('funnelId') funnelId: string,
  ) {
    return this.teamsService.getSystemTenantFunnel(id, funnelId);
  }

  @Patch('tenants/:id/funnels/:funnelId')
  updateTenantFunnel(
    @Param('id') id: string,
    @Param('funnelId') funnelId: string,
    @Body() dto: UpdateSystemTenantFunnelDto,
  ) {
    return this.teamsService.updateSystemTenantFunnel(id, funnelId, dto);
  }

  @Patch('tenants/:id/funnels/:funnelId/steps/:stepId')
  updateTenantFunnelStep(
    @Param('id') id: string,
    @Param('funnelId') funnelId: string,
    @Param('stepId') stepId: string,
    @Body() dto: UpdateSystemTenantFunnelStepDto,
  ) {
    return this.teamsService.updateSystemTenantFunnelStep(
      id,
      funnelId,
      stepId,
      dto,
    );
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateSystemTenantDto) {
    return this.teamsService.createSystemTenant(dto);
  }

  @Post('provision-tenant')
  provisionTenant(@Body() dto: ProvisionTenantDto) {
    return this.teamsService.provisionTenant(dto);
  }
}
