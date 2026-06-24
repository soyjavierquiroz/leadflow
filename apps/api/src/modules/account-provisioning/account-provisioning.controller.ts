import { Body, Controller, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { RequireAuth, RequireRoles } from '../auth/roles.decorator';
import type { AuthRequest } from '../auth/auth.types';
import { AccountProvisioningService } from './account-provisioning.service';
import type { CreateSystemIndividualAccountDto } from './dto/create-system-individual-account.dto';
import type { ProvisionIndividualAccountDto } from './dto/provision-individual-account.dto';

@Controller('onboarding')
export class AccountProvisioningController {
  constructor(
    private readonly accountProvisioningService: AccountProvisioningService,
  ) {}

  @Post('individual')
  @RequireAuth()
  async provisionIndividualAccount(
    @CurrentAuthUser() user: NonNullable<AuthRequest['authUser']>,
    @Body() dto: ProvisionIndividualAccountDto,
  ) {
    const context =
      await this.accountProvisioningService.provisionIndividualAccount(
        user,
        dto,
      );

    return {
      ...context,
      redirectTo: '/member/crm',
    };
  }
}

@Controller('system/tenants')
export class SystemIndividualAccountsController {
  constructor(
    private readonly accountProvisioningService: AccountProvisioningService,
  ) {}

  @Post('individual')
  @RequireRoles(UserRole.SUPER_ADMIN)
  createIndividualAccount(@Body() dto: CreateSystemIndividualAccountDto) {
    return this.accountProvisioningService.createSystemIndividualAccount(dto);
  }
}
