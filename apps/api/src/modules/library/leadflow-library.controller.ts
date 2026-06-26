import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RequireRoles } from '../auth/roles.decorator';
import { LeadflowLibraryService } from './leadflow-library.service';

@Controller('system/library')
@RequireRoles(UserRole.SUPER_ADMIN)
export class LeadflowLibraryController {
  constructor(
    private readonly leadflowLibraryService: LeadflowLibraryService,
  ) {}

  @Get()
  getSystemSnapshot() {
    return this.leadflowLibraryService.getSystemSnapshot();
  }
}
