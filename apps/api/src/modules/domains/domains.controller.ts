import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { CreateTeamDomainDto } from './dto/create-team-domain.dto';
import type { RecreateDomainOnboardingDto } from './dto/recreate-domain-onboarding.dto';
import type { UpdateTeamDomainDto } from './dto/update-team-domain.dto';
import { DomainsService } from './domains.service';

@Controller('domains')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class DomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly prisma: PrismaService,
  ) {}

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
  @RequireRoles(UserRole.SUPER_ADMIN)
  async create(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamDomainDto,
    @Query('teamId') teamId?: string,
  ) {
    const scope = await this.resolveMutationScope(user, { teamId });

    return this.domainsService.createForTeam(
      scope,
      dto,
    );
  }

  @Patch(':id')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async update(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') domainId: string,
    @Body() dto: UpdateTeamDomainDto,
    @Query('teamId') teamId?: string,
  ) {
    const scope = await this.resolveMutationScope(user, { teamId, domainId });

    return this.domainsService.updateForTeam(
      scope,
      domainId,
      dto,
    );
  }

  @Delete(':id')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async remove(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') domainId: string,
    @Query('teamId') teamId?: string,
  ) {
    const scope = await this.resolveMutationScope(user, { teamId, domainId });

    return this.domainsService.deleteForTeam(
      scope,
      domainId,
    );
  }

  @Post(':id/refresh')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async refresh(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') domainId: string,
    @Query('teamId') teamId?: string,
  ) {
    const scope = await this.resolveMutationScope(user, { teamId, domainId });

    return this.domainsService.refreshForTeam(
      scope,
      domainId,
    );
  }

  @Post(':id/recreate-onboarding')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async recreateOnboarding(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') domainId: string,
    @Query('teamId') teamId?: string,
    @Body() dto?: RecreateDomainOnboardingDto,
  ) {
    const scope = await this.resolveMutationScope(user, { teamId, domainId });

    return this.domainsService.recreateOnboardingForTeam(
      scope,
      domainId,
      dto,
    );
  }

  private async resolveMutationScope(
    user: AuthenticatedUser,
    input: {
      teamId?: string;
      domainId?: string;
    },
  ) {
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException({
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'Domain mutations require a super admin session.',
      });
    }

    if (input.domainId) {
      const domain = await this.prisma.domain.findUnique({
        where: { id: input.domainId },
        select: {
          workspaceId: true,
          teamId: true,
        },
      });

      if (!domain) {
        throw new NotFoundException({
          code: 'DOMAIN_NOT_FOUND',
          message: 'The requested domain was not found.',
        });
      }

      return domain;
    }

    const normalizedTeamId = input.teamId?.trim() ?? null;

    if (!normalizedTeamId) {
      throw new BadRequestException({
        code: 'TEAM_ID_REQUIRED',
        message: 'teamId is required for domain mutations.',
      });
    }

    const team = await this.prisma.team.findUnique({
      where: { id: normalizedTeamId },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: 'The requested team was not found.',
      });
    }

    return {
      workspaceId: team.workspaceId,
      teamId: team.id,
    };
  }
}
