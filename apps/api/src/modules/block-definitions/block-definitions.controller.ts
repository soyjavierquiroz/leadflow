import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RequireRoles } from '../auth/roles.decorator';
import { BlockDefinitionsService } from './block-definitions.service';

@Controller('system/block-definitions')
@RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
export class BlockDefinitionsController {
  constructor(
    private readonly blockDefinitionsService: BlockDefinitionsService,
  ) {}

  @Get()
  list() {
    return this.blockDefinitionsService.list();
  }
}
