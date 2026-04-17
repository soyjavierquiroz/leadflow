import { Module } from '@nestjs/common';
import { MailerService } from '../shared/mailer.service';
import { MailService } from './mail.service';

@Module({
  providers: [MailerService, MailService],
  exports: [MailerService, MailService],
})
export class MailModule {}
