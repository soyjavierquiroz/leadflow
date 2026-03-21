import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { CreateTeamFunnelPublicationDto } from './dto/create-team-funnel-publication.dto';
import type { UpdateTeamFunnelPublicationDto } from './dto/update-team-funnel-publication.dto';
import { FunnelPublicationsService } from './funnel-publications.service';

@Controller('funnel-publications')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class FunnelPublicationsController {
  constructor(
    private readonly funnelPublicationsService: FunnelPublicationsService,
  ) {}

  @Get()
  findAll(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
    @Query('domainId') domainId?: string,
  ) {
    return this.funnelPublicationsService.list({
      workspaceId:
        user.role === UserRole.SUPER_ADMIN
          ? (workspaceId ?? user.workspaceId ?? undefined)
          : (user.workspaceId ?? undefined),
      teamId:
        user.role === UserRole.SUPER_ADMIN
          ? teamId
          : (user.teamId ?? undefined),
      domainId,
    });
  }

  @Post()
  @RequireRoles(UserRole.TEAM_ADMIN)
  create(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamFunnelPublicationDto,
  ) {
    return this.funnelPublicationsService.createForTeam(
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
    @Param('id') funnelPublicationId: string,
    @Body() dto: UpdateTeamFunnelPublicationDto,
  ) {
    return this.funnelPublicationsService.updateForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      funnelPublicationId,
      dto,
    );
  }
}
