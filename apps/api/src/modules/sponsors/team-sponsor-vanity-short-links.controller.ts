import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { SponsorVanityShortLinksService } from './sponsor-vanity-short-links.service';

@Controller('team/sponsors/:sponsorId/vanity-shortlink')
@RequireRoles(UserRole.TEAM_ADMIN)
export class TeamSponsorVanityShortLinksController {
  constructor(
    private readonly vanityShortLinksService: SponsorVanityShortLinksService,
  ) {}

  @Get()
  get(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('sponsorId') sponsorId: string,
  ) {
    return this.vanityShortLinksService.getSponsorVanityShortLink({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId,
    });
  }

  @Post('generate')
  generate(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('sponsorId') sponsorId: string,
  ) {
    return this.vanityShortLinksService.generateSponsorVanityShortLink({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId,
    });
  }

  @Delete()
  delete(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('sponsorId') sponsorId: string,
  ) {
    return this.vanityShortLinksService.deleteSponsorVanityShortLink({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId,
    });
  }
}
