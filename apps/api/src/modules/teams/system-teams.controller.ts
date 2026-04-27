import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { CreateSystemTenantDto } from './dto/create-system-tenant.dto';
import type { UpdateSystemTenantFunnelDto } from './dto/update-system-tenant-funnel.dto';
import type { UpdateSystemTenantFunnelStepDto } from './dto/update-system-tenant-funnel-step.dto';
import type { UpdateSystemTenantDto } from './dto/update-system-tenant.dto';
import type { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { SystemTenantAccessGuard } from './system-tenant-access.guard';
import { TeamsService } from './teams.service';

@Controller('system')
@UseGuards(SystemTenantAccessGuard)
export class SystemTeamsController {
  private static readonly logger = new Logger(SystemTeamsController.name);

  constructor(private readonly teamsService: TeamsService) {}

  @Get('tenants')
  listTenants(@Query('includeArchived') includeArchived?: string) {
    return this.teamsService.listSystemTenants(includeArchived === 'true');
  }

  @Post('dev/wipe-leads')
  wipeLeadTestData() {
    return this.teamsService.wipeLeadTestData();
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
    SystemTeamsController.logger.log(
      `[theme-persist] PATCH /system/tenants/${id}/funnels/${funnelId} instance=${
        dto.funnelInstanceId ?? 'auto'
      } theme=${
        dto.settingsJson &&
        typeof dto.settingsJson === 'object' &&
        !Array.isArray(dto.settingsJson) &&
        'theme' in dto.settingsJson
          ? String((dto.settingsJson as Record<string, unknown>).theme ?? 'null')
          : 'missing'
      }`,
    );
    return this.teamsService.updateSystemTenantFunnel(id, funnelId, dto);
  }

  @Patch('tenants/:id/funnels/:funnelId/steps/:stepId')
  updateTenantFunnelStep(
    @CurrentAuthUser() user: AuthenticatedUser | undefined,
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
      user?.email ?? null,
    );
  }

  @Get('tenants/:id/funnels/:funnelId/steps/:stepId/history')
  listTenantFunnelStepHistory(
    @Param('id') id: string,
    @Param('funnelId') funnelId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.teamsService.listSystemTenantFunnelStepHistory(
      id,
      funnelId,
      stepId,
    );
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateSystemTenantDto) {
    return this.teamsService.createSystemTenant(dto);
  }

  @Patch('tenants/:id')
  updateTenant(
    @Param('id') id: string,
    @Body() dto: UpdateSystemTenantDto,
  ) {
    return this.teamsService.updateSystemTenant(id, dto);
  }

  @Patch('tenants/:id/archive')
  archiveTenant(@Param('id') id: string) {
    return this.teamsService.archiveSystemTenant(id);
  }

  @Post('provision-tenant')
  provisionTenant(@Body() dto: ProvisionTenantDto) {
    return this.teamsService.provisionTenant(dto);
  }
}
