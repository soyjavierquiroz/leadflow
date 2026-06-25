import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireOperationalMemberAccess } from '../auth/roles.decorator';
import { CommercialProfileService } from './commercial-profile.service';
import type { UpdateCommercialProfileDto } from './dto/update-commercial-profile.dto';

@Controller('commercial-profile')
export class CommercialProfileController {
  constructor(
    private readonly commercialProfileService: CommercialProfileService,
  ) {}

  @Get('me')
  @RequireOperationalMemberAccess()
  async getMe(@CurrentAuthUser() user: AuthenticatedUser) {
    await this.commercialProfileService.assertCurrentTeamSupportsCommercialProfile(
      user,
    );

    return this.commercialProfileService.getCommercialProfileSnapshotForTeam(
      user.teamId!,
    );
  }

  @Put('me')
  @RequireOperationalMemberAccess()
  async updateMe(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommercialProfileDto,
  ) {
    await this.commercialProfileService.assertCurrentTeamSupportsCommercialProfile(
      user,
    );

    const profile =
      await this.commercialProfileService.updateCommercialProfileForTeam(
        user.teamId!,
        dto,
      );

    return {
      profile,
      isComplete:
        this.commercialProfileService.isCommercialProfileComplete(profile),
    };
  }
}
