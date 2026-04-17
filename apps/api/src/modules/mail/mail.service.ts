import { Injectable } from '@nestjs/common';
import { MailerService } from '../shared/mailer.service';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendWelcomeEmail(
    email: string,
    plainPassword: string,
    teamName: string,
  ) {
    await this.mailerService.sendWelcomeEmail(
      email,
      plainPassword,
      teamName,
    );
  }
}
