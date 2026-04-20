import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { AddKurukinBlacklistEntryDto } from './dto/add-kurukin-blacklist-entry.dto';
import { RemoveKurukinBlacklistEntryDto } from './dto/remove-kurukin-blacklist-entry.dto';
import { KurukinBlacklistService } from './kurukin-blacklist.service';

@Controller('kurukin-blacklist')
@RequireRoles(UserRole.MEMBER)
export class KurukinBlacklistController {
  constructor(
    private readonly kurukinBlacklistService: KurukinBlacklistService,
  ) {}

  @Get('me')
  async listForMember(@CurrentAuthUser() user: AuthenticatedUser) {
    const payload = await this.kurukinBlacklistService.listForMember({
      workspaceId: user.workspaceId!,
      teamId: user.teamId!,
      sponsorId: user.sponsorId!,
    });

    const response = {
      ownerPhone: payload.ownerPhone,
      sponsorName: payload.sponsorName,
      items: payload.items.map((item) => ({
        id: item.id,
        ownerPhone: item.ownerPhone,
        blockedPhone: item.blockedPhone,
        reason: item.reason,
        createdAt: item.createdAt,
      })),
    };

    return response;
  }

  @Post('me')
  addForMember(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: AddKurukinBlacklistEntryDto,
  ) {
    return this.kurukinBlacklistService.addForMember(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      dto,
    );
  }

  @Delete('me')
  removeForMember(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: RemoveKurukinBlacklistEntryDto,
  ) {
    return this.kurukinBlacklistService.removeForMember(
      {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        sponsorId: user.sponsorId!,
      },
      dto,
    );
  }
}
