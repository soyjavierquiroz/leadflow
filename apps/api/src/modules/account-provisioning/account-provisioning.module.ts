import { Module } from '@nestjs/common';
import { CommercialProfileModule } from '../commercial-profile/commercial-profile.module';
import { MailModule } from '../mail/mail.module';
import {
  AccountProvisioningController,
  SystemIndividualAccountsController,
} from './account-provisioning.controller';
import { AccountProvisioningService } from './account-provisioning.service';

@Module({
  imports: [CommercialProfileModule, MailModule],
  controllers: [
    AccountProvisioningController,
    SystemIndividualAccountsController,
  ],
  providers: [AccountProvisioningService],
  exports: [AccountProvisioningService],
})
export class AccountProvisioningModule {}
