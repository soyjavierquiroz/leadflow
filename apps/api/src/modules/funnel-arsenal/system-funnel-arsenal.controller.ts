import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RequireRoles } from '../auth/roles.decorator';
import type { CreateSystemFunnelArsenalTemplateDto } from './dto/create-system-funnel-arsenal-template.dto';
import type { UpdateSystemFunnelArsenalTemplateDto } from './dto/update-system-funnel-arsenal-template.dto';
import { FunnelArsenalService } from './funnel-arsenal.service';

@Controller('system/funnel-arsenal')
@RequireRoles(UserRole.SUPER_ADMIN)
export class SystemFunnelArsenalController {
  constructor(private readonly funnelArsenalService: FunnelArsenalService) {}

  @Get()
  listTemplates() {
    return this.funnelArsenalService.listSystemTemplates();
  }

  @Get(':assetSlug/preview')
  previewTemplate(
    @Param('assetSlug') assetSlug: string,
    @Query('step') stepSlug?: string,
  ) {
    return this.funnelArsenalService.getSystemPreviewRuntime(
      assetSlug,
      stepSlug,
    );
  }

  @Get(':assetSlug')
  getTemplate(@Param('assetSlug') assetSlug: string) {
    return this.funnelArsenalService.getSystemTemplate(assetSlug);
  }

  @Post()
  createTemplate(@Body() dto: CreateSystemFunnelArsenalTemplateDto) {
    return this.funnelArsenalService.createSystemTemplate(dto);
  }

  @Patch(':templateKey')
  updateTemplate(
    @Param('templateKey') templateKey: string,
    @Body() dto: UpdateSystemFunnelArsenalTemplateDto,
  ) {
    return this.funnelArsenalService.updateSystemTemplate(templateKey, dto);
  }

  @Delete(':templateKey')
  archiveTemplate(@Param('templateKey') templateKey: string) {
    return this.funnelArsenalService.archiveSystemTemplate(templateKey);
  }
}
