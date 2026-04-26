import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailClient } from '@leadflow/mail';

const DEFAULT_LOGIN_URL = 'http://localhost:3000/login';
const DEFAULT_PUBLIC_SITE_URL = 'http://localhost:3000';

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
  private readonly mailClient: MailClient;

  constructor(private readonly configService: ConfigService) {
    this.mailClient = new MailClient({
      env: {
        get: (key) => this.configService.get<string>(key),
      },
      logger: this.logger,
    });
  }

  async sendAdvisorWelcomeEmail(input: {
    email: string;
    tempPassword: string;
    teamName?: string | null;
  }) {
    const normalizedEmail =
      sanitizeNullableText(input.email)?.toLowerCase() ??
      'unknown@leadflow.local';
    const normalizedPassword = sanitizeNullableText(input.tempPassword) ?? '';
    const normalizedTeamName =
      sanitizeNullableText(input.teamName) ?? 'Leadflow';
    const loginUrl = this.resolveLoginUrl();

    await this.mailClient.sendSystemEmail({
      toAddress: normalizedEmail,
      subject: 'Tu acceso a LeadFlow ya esta listo',
      title: 'Tu acceso a LeadFlow ya esta listo',
      paragraphs: [
        `Tu usuario de asesor para el team "${normalizedTeamName}" ya fue creado en LeadFlow.`,
        'Inicia sesion y cambia tu password lo antes posible para asegurar tu cuenta.',
      ],
      details: [
        {
          label: 'Acceso',
          value: loginUrl,
          href: loginUrl,
        },
        {
          label: 'Email',
          value: normalizedEmail,
        },
        {
          label: 'Password temporal',
          value: normalizedPassword,
        },
      ],
      action: {
        label: 'Entrar a LeadFlow',
        href: loginUrl,
      },
    });
  }

  async sendAdvisorActivationEmail(input: {
    email: string;
    teamName: string;
    publicSlug?: string | null;
  }) {
    const normalizedEmail =
      sanitizeNullableText(input.email)?.toLowerCase() ??
      'unknown@leadflow.local';
    const normalizedTeamName = sanitizeNullableText(input.teamName) ?? 'Leadflow';
    const loginUrl = this.resolveLoginUrl();
    const personalLink = this.buildAdvisorPublicUrl(input.publicSlug ?? null);
    const personalLinkText = personalLink
      ? `Tu enlace personal ya esta activo: ${personalLink}`
      : 'Tu enlace personal ya quedo marcado como activo para recibir leads.';

    await this.mailClient.sendSystemEmail({
      toAddress: normalizedEmail,
      subject: 'Tu licencia de asesor ya fue activada',
      title: 'Tu licencia de asesor ya fue activada',
      paragraphs: [
        `Tu licencia dentro del team "${normalizedTeamName}" ya esta activa.`,
        'Desde este momento puedes operar normalmente dentro de LeadFlow.',
        personalLinkText,
      ],
      details: [
        ...(personalLink
          ? [
              {
                label: 'Enlace personal',
                value: personalLink,
                href: personalLink,
              },
            ]
          : []),
        {
          label: 'Acceso operativo',
          value: loginUrl,
          href: loginUrl,
        },
      ],
      action: personalLink
        ? {
            label: 'Abrir mi enlace personal',
            href: personalLink,
          }
        : {
            label: 'Entrar a LeadFlow',
            href: loginUrl,
          },
      footerNote:
        'Si no reconoces esta activacion, avisa a tu Team Admin de inmediato.',
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

    await this.mailClient.sendSystemEmail({
      toAddress: normalizedEmail,
      subject: 'Tu acceso a LeadFlow ya esta listo',
      title: 'Tu acceso a LeadFlow ya esta listo',
      paragraphs: [
        `Tu acceso para el team "${normalizedTeamName}" ya esta listo.`,
        'Inicia sesion y cambia tu password lo antes posible para asegurar tu cuenta.',
      ],
      details: [
        {
          label: 'Acceso',
          value: loginUrl,
          href: loginUrl,
        },
        {
          label: 'Email',
          value: normalizedEmail,
        },
        {
          label: 'Password temporal',
          value: normalizedPassword,
        },
      ],
      action: {
        label: 'Entrar a LeadFlow',
        href: loginUrl,
      },
    });
  }

  private buildAdvisorPublicUrl(publicSlug: string | null) {
    const normalizedSlug = sanitizeNullableText(publicSlug);

    if (!normalizedSlug) {
      return null;
    }

    return `${this.resolvePublicSiteUrl()}/a/${normalizedSlug}`;
  }

  private resolvePublicSiteUrl() {
    return (
      sanitizeNullableText(this.configService.get<string>('SITE_URL')) ??
      sanitizeNullableText(this.configService.get<string>('ADMIN_URL')) ??
      DEFAULT_PUBLIC_SITE_URL
    ).replace(/\/+$/, '');
  }

  private resolveLoginUrl() {
    return (
      sanitizeNullableText(this.configService.get<string>('ADMIN_URL')) ??
      sanitizeNullableText(this.configService.get<string>('SITE_URL')) ??
      DEFAULT_LOGIN_URL
    );
  }
}
