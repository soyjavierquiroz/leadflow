import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import type { CloneFunnelTemplateDto } from './dto/clone-funnel-template.dto';
import { FunnelsService } from './funnels.service';

@Controller('system/funnels')
@UseGuards(SystemTenantAccessGuard)
export class SystemFunnelsController {
  constructor(private readonly funnelsService: FunnelsService) {}

  @Get('templates')
  listTemplates() {
    return this.funnelsService.listSystemTemplates();
  }

  @Post(':templateId/clone')
  cloneTemplateToTeam(
    @Param('templateId') templateId: string,
    @Body() dto: CloneFunnelTemplateDto,
  ) {
    return this.funnelsService.cloneTemplateToTeam(
      templateId,
      dto.targetTeamId,
      dto.newName,
    );
  }
}
