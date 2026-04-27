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
import {
  RequireOperationalMemberAccess,
  RequireRoles,
} from '../auth/roles.decorator';
import { MemberDashboardDto } from './dto/member-dashboard.dto';
import type { UpdateMemberSponsorDto } from './dto/update-member-sponsor.dto';
import type { UpdateTeamSponsorDto } from './dto/update-team-sponsor.dto';
import { SponsorsService } from './sponsors.service';
import { LeadsService } from '../leads/leads.service';
import type { UpdateMemberLeadDto } from '../leads/dto/update-member-lead.dto';

@Controller('sponsors')
export class SponsorsController {
  constructor(
    private readonly sponsorsService: SponsorsService,
    private readonly leadsService: LeadsService,
  ) {}

  @Get()
  @RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
  findAll(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.sponsorsService.list({
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

  @Get('me/dashboard')
  @RequireOperationalMemberAccess()
  getMemberDashboard(
    @CurrentAuthUser() user: AuthenticatedUser,
  ): Promise<MemberDashboardDto> {
    return this.sponsorsService.getDashboardForMember({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }

  @Get('me/kredits')
  @RequireOperationalMemberAccess()
  getMemberKredits(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.sponsorsService.getKreditsForMember({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }

  @Get('me/link-gallery')
  @RequireOperationalMemberAccess()
  getMemberLinkGallery(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.sponsorsService.getLinkGalleryForMember({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }

  @Get('me')
  @RequireOperationalMemberAccess()
  findMe(@CurrentAuthUser() user: AuthenticatedUser) {
    return this.sponsorsService.findForMember({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }

  @Patch('me')
  @RequireOperationalMemberAccess()
  updateMe(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberSponsorDto,
  ) {
    return this.sponsorsService.updateForMember(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      dto,
    );
  }

  @Post('me/leads/:id/accept')
  @RequireOperationalMemberAccess()
  acceptLead(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') leadId: string,
  ) {
    return this.sponsorsService.acceptLeadForMember(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      leadId,
    );
  }

  @Patch('me/leads/:id/status')
  @RequireOperationalMemberAccess()
  updateLeadStatus(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') leadId: string,
    @Body() dto: UpdateMemberLeadDto,
  ) {
    return this.leadsService.updateForMember(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      leadId,
      dto,
    );
  }

  @Patch(':id')
  @RequireRoles(UserRole.TEAM_ADMIN)
  update(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') sponsorId: string,
    @Body() dto: UpdateTeamSponsorDto,
  ) {
    return this.sponsorsService.updateForTeam(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
      },
      sponsorId,
      dto,
    );
  }
}
