import { Body, Controller, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import type { ApplyBlueprintDto } from './dto/apply-blueprint.dto';
import { BlueprintService } from './blueprint.service';

@Controller('funnels')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class FunnelsController {
  constructor(private readonly blueprintService: BlueprintService) {}

  @Post(':id/apply-blueprint')
  applyBlueprint(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') funnelInstanceId: string,
    @Body() dto: ApplyBlueprintDto,
  ) {
    return this.blueprintService.applyBlueprintForUser(
      user,
      funnelInstanceId,
      dto.type,
      dto.mode,
    );
  }
}
