import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import type { DeployTemplateDto } from './dto/deploy-template.dto';
import type { CreateTemplateDto } from './dto/create-template.dto';
import type { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateService } from './template.service';

@Controller('system/templates')
@UseGuards(SystemTenantAccessGuard)
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Get()
  list() {
    return this.templateService.list();
  }

  @Get(':templateId')
  getById(@Param('templateId') templateId: string) {
    return this.templateService.getById(templateId);
  }

  @Patch(':templateId')
  update(
    @Param('templateId') templateId: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateService.update(templateId, dto);
  }

  @Post(':templateId/deploy')
  deploy(
    @Param('templateId') templateId: string,
    @Body() dto: DeployTemplateDto,
  ) {
    return this.templateService.deploy(templateId, dto);
  }
}
