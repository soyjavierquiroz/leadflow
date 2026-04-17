import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const DEFAULT_FROM_ADDRESS = 'no-reply@leadflow.local';
const DEFAULT_LOGIN_URL = 'http://localhost:3000/login';

const sanitizeNullableText = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private sesClient: SESClient | null = null;
  private sesClientResolved = false;

  constructor(private readonly configService: ConfigService) {}

  async sendAdvisorWelcomeEmail(email: string, tempPassword: string) {
    const normalizedEmail =
      sanitizeNullableText(email)?.toLowerCase() ?? 'unknown@leadflow.local';
    const normalizedPassword = sanitizeNullableText(tempPassword) ?? '';
    const loginUrl = this.resolveLoginUrl();

    await this.sendEmail({
      toAddress: normalizedEmail,
      subject: 'Tu acceso a Leadflow ya esta listo',
      text: [
        'Hola,',
        '',
        'Tu usuario de asesor ya fue creado en Leadflow.',
        '',
        `Login URL: ${loginUrl}`,
        `Email: ${normalizedEmail}`,
        `Password temporal: ${normalizedPassword}`,
        '',
        'Inicia sesion y cambia tu password lo antes posible.',
      ].join('\n'),
    });
  }

  async sendAdvisorActivationEmail(email: string, teamName: string) {
    const normalizedEmail =
      sanitizeNullableText(email)?.toLowerCase() ?? 'unknown@leadflow.local';
    const normalizedTeamName = sanitizeNullableText(teamName) ?? 'Leadflow';
    const loginUrl = this.resolveLoginUrl();

    await this.sendEmail({
      toAddress: normalizedEmail,
      subject: 'Tu licencia de asesor ya fue activada',
      text: [
        'Hola,',
        '',
        `Tu licencia dentro del team "${normalizedTeamName}" ya esta activa.`,
        'Desde este momento puedes operar normalmente dentro de Leadflow.',
        '',
        `Login URL: ${loginUrl}`,
        '',
        'Si no reconoces esta activacion, avisa a tu Team Admin.',
      ].join('\n'),
    });
  }

  async sendWelcomeEmail(
    email: string,
    plainPassword: string,
    teamName: string,
  ) {
    const normalizedEmail =
      sanitizeNullableText(email)?.toLowerCase() ?? 'unknown@leadflow.local';
    const normalizedPassword = sanitizeNullableText(plainPassword) ?? '';
    const normalizedTeamName = sanitizeNullableText(teamName) ?? 'Leadflow';
    const loginUrl = this.resolveLoginUrl();

    await this.sendEmail({
      toAddress: normalizedEmail,
      subject: 'Tu acceso a Leadflow ya esta listo',
      text: [
        'Hola,',
        '',
        `Tu acceso para el team "${normalizedTeamName}" ya esta listo.`,
        '',
        `Login URL: ${loginUrl}`,
        `Email: ${normalizedEmail}`,
        `Password temporal: ${normalizedPassword}`,
        '',
        'Inicia sesion y cambia tu password lo antes posible.',
      ].join('\n'),
    });
  }

  private async sendEmail(input: {
    toAddress: string;
    subject: string;
    text: string;
  }) {
    const client = this.resolveSesClient();

    if (!client) {
      this.logger.warn(
        `SES mail skipped for ${input.toAddress}: AWS SES credentials are not fully configured.`,
      );
      return;
    }

    await client.send(
      new SendEmailCommand({
        Source: this.resolveFromAddress(),
        Destination: {
          ToAddresses: [input.toAddress],
        },
        Message: {
          Subject: {
            Charset: 'UTF-8',
            Data: input.subject,
          },
          Body: {
            Text: {
              Charset: 'UTF-8',
              Data: input.text,
            },
          },
        },
      }),
    );
  }

  private resolveSesClient() {
    if (this.sesClientResolved) {
      return this.sesClient;
    }

    this.sesClientResolved = true;

    const region = sanitizeNullableText(
      this.configService.get<string>('AWS_REGION'),
    );
    const accessKeyId = sanitizeNullableText(
      this.configService.get<string>('AWS_ACCESS_KEY_ID'),
    );
    const secretAccessKey = sanitizeNullableText(
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
    );

    if (!region || !accessKeyId || !secretAccessKey) {
      this.sesClient = null;
      return this.sesClient;
    }

    this.sesClient = new SESClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.sesClient;
  }

  private resolveFromAddress() {
    return (
      sanitizeNullableText(
        this.configService.get<string>('MAIL_FROM_ADDRESS'),
      ) ?? DEFAULT_FROM_ADDRESS
    );
  }

  private resolveLoginUrl() {
    return (
      sanitizeNullableText(this.configService.get<string>('ADMIN_URL')) ??
      sanitizeNullableText(this.configService.get<string>('SITE_URL')) ??
      DEFAULT_LOGIN_URL
    );
  }
}
