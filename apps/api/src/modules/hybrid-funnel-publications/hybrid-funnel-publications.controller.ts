import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { CreateTeamHybridFunnelPublicationDto } from './dto/create-team-hybrid-funnel-publication.dto';
import type { UpdateTeamHybridFunnelPublicationDto } from './dto/update-team-hybrid-funnel-publication.dto';
import { HybridFunnelPublicationsService } from './hybrid-funnel-publications.service';

@Controller('hybrid-funnel-publications')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class HybridFunnelPublicationsController {
  constructor(
    private readonly hybridFunnelPublicationsService: HybridFunnelPublicationsService,
  ) {}

  @Get(':id')
  @RequireRoles(UserRole.TEAM_ADMIN)
  findOne(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') publicationId: string,
  ) {
    return this.hybridFunnelPublicationsService.findForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      publicationId,
    );
  }

  @Post()
  @RequireRoles(UserRole.TEAM_ADMIN)
  create(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamHybridFunnelPublicationDto,
  ) {
    return this.hybridFunnelPublicationsService.createForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      dto,
    );
  }

  @Patch(':id')
  @RequireRoles(UserRole.TEAM_ADMIN)
  update(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') publicationId: string,
    @Body() dto: UpdateTeamHybridFunnelPublicationDto,
  ) {
    return this.hybridFunnelPublicationsService.updateForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      publicationId,
      dto,
    );
  }
}
