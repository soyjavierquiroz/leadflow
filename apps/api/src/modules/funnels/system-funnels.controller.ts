import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import type { CloneFunnelTemplateDto } from './dto/clone-funnel-template.dto';
import type { CreateSystemFunnelTemplateDto } from './dto/create-system-funnel-template.dto';
import type { UpdateSystemFunnelTemplateDto } from './dto/update-system-funnel-template.dto';
import { FunnelsService } from './funnels.service';

@Controller('system/funnels')
@UseGuards(SystemTenantAccessGuard)
export class SystemFunnelsController {
  constructor(private readonly funnelsService: FunnelsService) {}

  @Get('templates')
  listTemplates() {
    return this.funnelsService.listSystemTemplates();
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateSystemFunnelTemplateDto) {
    return this.funnelsService.createSystemTemplate(dto);
  }

  @Get('templates/:id')
  getTemplate(@Param('id') templateId: string) {
    return this.funnelsService.getSystemTemplate(templateId);
  }

  @Patch('templates/:id')
  updateTemplate(
    @Param('id') templateId: string,
    @Body() dto: UpdateSystemFunnelTemplateDto,
  ) {
    return this.funnelsService.updateSystemTemplate(templateId, dto);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') templateId: string) {
    return this.funnelsService.deleteSystemTemplate(templateId);
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
