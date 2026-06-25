import { Body, Controller, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RequireRoles } from '../auth/roles.decorator';
import type { CreateMarketplaceMasterFunnelDto } from './dto/create-marketplace-master-funnel.dto';
import { FunnelArsenalService } from './funnel-arsenal.service';

@Controller('system/funnel-marketplace')
@RequireRoles(UserRole.SUPER_ADMIN)
export class SystemFunnelMarketplaceController {
  constructor(private readonly funnelArsenalService: FunnelArsenalService) {}

  @Post(':assetSlug/master-funnel')
  createMasterFunnel(
    @Param('assetSlug') assetSlug: string,
    @Body() dto: CreateMarketplaceMasterFunnelDto = {},
  ) {
    return this.funnelArsenalService.createSystemMarketplaceMasterFunnel(
      assetSlug,
      dto,
    );
  }
}
