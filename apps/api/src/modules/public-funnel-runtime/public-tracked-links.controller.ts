import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SystemApiGuard } from '../webhooks/system-api.guard';
import type { GenerateTrackedLinkDto } from './dto/generate-tracked-link.dto';
import { PublicIdentityLinkService } from './public-identity-link.service';

@Controller('automation')
export class PublicTrackedLinksController {
  constructor(
    private readonly publicIdentityLinkService: PublicIdentityLinkService,
  ) {}

  @Post('generate-tracked-link')
  @UseGuards(SystemApiGuard)
  generateTrackedLink(@Body() dto: GenerateTrackedLinkDto) {
    return this.publicIdentityLinkService.generateTrackedLink({
      leadId: dto.leadId,
      stepKey: dto.stepKey,
    });
  }
}
