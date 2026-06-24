import { Body, Controller, Post } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { RequireAuth } from '../auth/roles.decorator';
import type { AuthRequest } from '../auth/auth.types';
import { AccountProvisioningService } from './account-provisioning.service';
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
