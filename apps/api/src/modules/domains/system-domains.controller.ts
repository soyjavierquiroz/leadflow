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
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import type { CreateTeamDomainDto } from './dto/create-team-domain.dto';
import type { CreateSystemTenantDomainDto } from './dto/create-system-tenant-domain.dto';
import { buildDomainVerificationFeedback } from './domain-onboarding.utils';
import { DomainsService } from './domains.service';

@Controller('system/tenants')
@UseGuards(SystemTenantAccessGuard)
export class SystemDomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/domains')
  async listTenantDomains(@Param('id') id: string) {
    const team = await this.resolveTenantScope(id);

    return this.domainsService.list({
      teamId: team.teamId,
    });
  }

  @Post(':id/domains')
  async createTenantDomain(
    @Param('id') id: string,
    @Body() dto: CreateSystemTenantDomainDto,
  ) {
    const team = await this.resolveTenantScope(id);
    const host = dto.hostname?.trim() ?? '';

    if (!host) {
      throw new BadRequestException({
        code: 'HOST_REQUIRED',
        message: 'hostname is required.',
      });
    }

    const createDomainDto: CreateTeamDomainDto = {
      host,
      linkedFunnelId: dto.funnelId?.trim() || null,
    };

    return this.domainsService.createForTeam(team, createDomainDto);
  }

  @Post(':id/domains/:domainId/verify')
  async verifyTenantDomain(
    @Param('id') id: string,
    @Param('domainId') domainId: string,
  ) {
    const team = await this.resolveTenantScope(id);
    const domain = await this.domainsService.refreshForTeam(team, domainId);
    const feedback = buildDomainVerificationFeedback(domain);

    return {
      domain,
      status: feedback.status,
      errorDetail: feedback.errorDetail,
    };
  }

  @Delete(':id/domains/:domainId')
  async deleteTenantDomain(
    @Param('id') id: string,
    @Param('domainId') domainId: string,
  ) {
    const team = await this.resolveTenantScope(id);

    return this.domainsService.deleteForTeam(team, domainId);
  }

  @Patch(':id/domains/:domainId/set-primary')
  async setPrimaryTenantDomain(
    @Param('id') id: string,
    @Param('domainId') domainId: string,
  ) {
    const team = await this.resolveTenantScope(id);

    return this.domainsService.setPrimaryForTeam(team, domainId);
  }

  private requireTenantId(id: string) {
    const tenantId = id.trim();

    if (!tenantId) {
      throw new BadRequestException({
        code: 'TENANT_ID_REQUIRED',
        message: 'A valid tenant id is required.',
      });
    }

    return tenantId;
  }

  private async resolveTenantScope(id: string) {
    const tenantId = this.requireTenantId(id);
    const team = await this.prisma.team.findUnique({
      where: {
        id: tenantId,
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'The requested tenant was not found.',
      });
    }

    return {
      teamId: team.id,
      workspaceId: team.workspaceId,
    };
  }
}
