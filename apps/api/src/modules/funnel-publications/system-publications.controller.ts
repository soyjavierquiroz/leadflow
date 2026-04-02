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
import type { CreateSystemPublicationDto } from './dto/create-system-publication.dto';
import type { UpdateSystemPublicationDto } from './dto/update-system-publication.dto';
import { SystemPublicationsService } from './system-publications.service';

@Controller('system/publications')
@UseGuards(SystemTenantAccessGuard)
export class SystemPublicationsController {
  constructor(
    private readonly systemPublicationsService: SystemPublicationsService,
  ) {}

  @Get()
  findAll() {
    return this.systemPublicationsService.list();
  }

  @Post()
  create(@Body() dto: CreateSystemPublicationDto) {
    return this.systemPublicationsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') publicationId: string,
    @Body() dto: UpdateSystemPublicationDto,
  ) {
    return this.systemPublicationsService.update(publicationId, dto);
  }

  @Delete(':id')
  remove(@Param('id') publicationId: string) {
    return this.systemPublicationsService.remove(publicationId);
  }
}
