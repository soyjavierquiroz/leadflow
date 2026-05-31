import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SystemApiGuard } from '../webhooks/system-api.guard';
import type { ResolveActionLinkDto } from './dto/resolve-action-link.dto';
import { ActionLinkResolverService } from './action-link-resolver.service';

@Controller('action-links')
export class ActionLinksController {
  constructor(
    private readonly actionLinkResolverService: ActionLinkResolverService,
  ) {}

  @Post('resolve')
  @UseGuards(SystemApiGuard)
  resolveActionLink(@Body() dto: ResolveActionLinkDto) {
    return this.actionLinkResolverService.resolve({
      leadId: dto.leadId,
      assignmentId: dto.assignmentId,
      appKey: dto.appKey,
      actionKey: dto.actionKey,
      purpose: dto.purpose,
      channel: dto.channel,
      params: dto.params,
      idempotencyKey: dto.idempotencyKey,
      createdBy: dto.createdBy,
    });
  }
}
