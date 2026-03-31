import { Controller, Get, Post, Body } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { ConnectMemberMessagingDto } from './dto/connect-member-messaging.dto';
import { SponsorDashboardDto } from './dto/sponsor-dashboard.dto';
import { MessagingIntegrationsService } from './messaging-integrations.service';

@Controller('messaging-integrations')
@RequireRoles(UserRole.MEMBER)
export class MessagingIntegrationsController {
  constructor(
    private readonly messagingIntegrationsService: MessagingIntegrationsService,
  ) {}

  @Get('me')
  getCurrent(
    @CurrentAuthUser() user: AuthenticatedUser,
  ): Promise<SponsorDashboardDto> {
    return this.messagingIntegrationsService.getCurrentForMember({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }

  @Post('me/connect')
  connect(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: ConnectMemberMessagingDto,
  ): Promise<SponsorDashboardDto> {
    return this.messagingIntegrationsService.connectForMember(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      dto,
    );
  }

  @Post('me/refresh')
  refresh(
    @CurrentAuthUser() user: AuthenticatedUser,
  ): Promise<SponsorDashboardDto> {
    return this.messagingIntegrationsService.refreshForMember({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }

  @Post('me/qr')
  getQr(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: ConnectMemberMessagingDto,
  ): Promise<SponsorDashboardDto> {
    return this.messagingIntegrationsService.getQrForMember(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      dto,
    );
  }

  @Post('me/reset')
  reset(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: ConnectMemberMessagingDto,
  ): Promise<SponsorDashboardDto> {
    return this.messagingIntegrationsService.resetForMember(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      dto,
    );
  }

  @Post('me/disconnect')
  disconnect(
    @CurrentAuthUser() user: AuthenticatedUser,
  ): Promise<SponsorDashboardDto> {
    return this.messagingIntegrationsService.disconnectForMember({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });
  }
}
