import { Module } from '@nestjs/common';
import { AccountProvisioningController } from './account-provisioning.controller';
import { AccountProvisioningService } from './account-provisioning.service';

@Module({
  controllers: [AccountProvisioningController],
  providers: [AccountProvisioningService],
  exports: [AccountProvisioningService],
})
export class AccountProvisioningModule {}
