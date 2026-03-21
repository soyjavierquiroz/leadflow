import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RequireRoles } from '../auth/roles.decorator';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@RequireRoles(UserRole.SUPER_ADMIN)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  findAll() {
    return this.workspacesService.list();
  }
}
