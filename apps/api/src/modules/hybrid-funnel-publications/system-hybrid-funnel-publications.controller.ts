import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import type { UpdateTeamHybridFunnelPublicationDto } from './dto/update-team-hybrid-funnel-publication.dto';
import { HybridFunnelPublicationsService } from './hybrid-funnel-publications.service';

@Controller('system/tenants/:teamId/hybrid-funnel-publications')
@UseGuards(SystemTenantAccessGuard)
export class SystemHybridFunnelPublicationsController {
  constructor(
    private readonly hybridFunnelPublicationsService: HybridFunnelPublicationsService,
  ) {}

  @Get(':publicationId')
  findOne(
    @Param('teamId') teamId: string,
    @Param('publicationId') publicationId: string,
  ) {
    return this.hybridFunnelPublicationsService.findForSystemTenant(
      teamId,
      publicationId,
    );
  }

  @Get(':publicationId/steps/:stepId/history')
  listStepHistory(
    @Param('teamId') teamId: string,
    @Param('publicationId') publicationId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.hybridFunnelPublicationsService.listStepHistoryForSystemTenant(
      teamId,
      publicationId,
      stepId,
    );
  }

  @Patch(':publicationId')
  update(
    @CurrentAuthUser() user: AuthenticatedUser | undefined,
    @Param('teamId') teamId: string,
    @Param('publicationId') publicationId: string,
    @Body() dto: UpdateTeamHybridFunnelPublicationDto,
  ) {
    return this.hybridFunnelPublicationsService.updateForSystemTenant(
      teamId,
      publicationId,
      dto,
      user?.email ?? null,
    );
  }
}
