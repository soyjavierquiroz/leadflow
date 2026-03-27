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
import type { CreateTeamDomainDto } from './dto/create-team-domain.dto';
import type { UpdateTeamDomainDto } from './dto/update-team-domain.dto';
import { DomainsService } from './domains.service';

@Controller('domains')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  findAll(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.domainsService.list({
      workspaceId:
        user.role === UserRole.SUPER_ADMIN
          ? (workspaceId ?? user.workspaceId ?? undefined)
          : (user.workspaceId ?? undefined),
      teamId:
        user.role === UserRole.SUPER_ADMIN
          ? teamId
          : (user.teamId ?? undefined),
    });
  }

  @Post()
  @RequireRoles(UserRole.TEAM_ADMIN)
  create(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamDomainDto,
  ) {
    return this.domainsService.createForTeam(
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
    @Param('id') domainId: string,
    @Body() dto: UpdateTeamDomainDto,
  ) {
    return this.domainsService.updateForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      domainId,
      dto,
    );
  }

  @Post(':id/refresh')
  @RequireRoles(UserRole.TEAM_ADMIN)
  refresh(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') domainId: string,
  ) {
    return this.domainsService.refreshForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      domainId,
    );
  }
}
