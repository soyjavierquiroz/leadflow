import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const DEFAULT_FROM_ADDRESS = 'no-reply@leadflow.local';
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
  private sesClient: SESClient | null = null;
  private sesClientResolved = false;

  constructor(private readonly configService: ConfigService) {}

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

    await this.sendEmail({
      toAddress: normalizedEmail,
      subject: 'Tu acceso a Leadflow ya esta listo',
      text: [
        'Hola,',
        '',
        `Tu usuario de asesor para el team "${normalizedTeamName}" ya fue creado en Leadflow.`,
        '',
        `Login URL: ${loginUrl}`,
        `Email: ${normalizedEmail}`,
        `Password temporal: ${normalizedPassword}`,
        '',
        'Inicia sesion y cambia tu password lo antes posible.',
      ].join('\n'),
      html: this.buildEmailShell({
        title: 'Tu acceso a Leadflow ya esta listo',
        intro: `Tu usuario de asesor para el team <strong>${this.escapeHtml(
          normalizedTeamName,
        )}</strong> ya fue creado en Leadflow.`,
        sections: [
          {
            label: 'Acceso',
            value: `<a href="${this.escapeHtml(loginUrl)}">${this.escapeHtml(
              loginUrl,
            )}</a>`,
          },
          {
            label: 'Email',
            value: this.escapeHtml(normalizedEmail),
          },
          {
            label: 'Password temporal',
            value: this.escapeHtml(normalizedPassword),
          },
        ],
        outro:
          'Inicia sesion y cambia tu password lo antes posible para asegurar tu cuenta.',
        cta: {
          label: 'Entrar a Leadflow',
          href: loginUrl,
        },
      }),
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

    await this.sendEmail({
      toAddress: normalizedEmail,
      subject: 'Tu licencia de asesor ya fue activada',
      text: [
        'Hola,',
        '',
        `Tu licencia dentro del team "${normalizedTeamName}" ya esta activa.`,
        'Desde este momento puedes operar normalmente dentro de Leadflow.',
        '',
        personalLinkText,
        '',
        `Login URL: ${loginUrl}`,
        '',
        'Si no reconoces esta activacion, avisa a tu Team Admin.',
      ].join('\n'),
      html: this.buildEmailShell({
        title: 'Tu licencia de asesor ya fue activada',
        intro: `Tu licencia dentro del team <strong>${this.escapeHtml(
          normalizedTeamName,
        )}</strong> ya esta activa y quedaste disponible para recibir leads.`,
        sections: [
          ...(personalLink
            ? [
                {
                  label: 'Enlace personal',
                  value: `<a href="${this.escapeHtml(
                    personalLink,
                  )}">${this.escapeHtml(personalLink)}</a>`,
                },
              ]
            : []),
          {
            label: 'Acceso operativo',
            value: `<a href="${this.escapeHtml(loginUrl)}">${this.escapeHtml(
              loginUrl,
            )}</a>`,
          },
        ],
        outro:
          'Si no reconoces esta activacion, avisa a tu Team Admin de inmediato.',
        cta: personalLink
          ? {
              label: 'Abrir mi enlace personal',
              href: personalLink,
            }
          : {
              label: 'Entrar a Leadflow',
              href: loginUrl,
            },
      }),
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
      html: this.buildEmailShell({
        title: 'Tu acceso a Leadflow ya esta listo',
        intro: `Tu acceso para el team <strong>${this.escapeHtml(
          normalizedTeamName,
        )}</strong> ya esta listo.`,
        sections: [
          {
            label: 'Acceso',
            value: `<a href="${this.escapeHtml(loginUrl)}">${this.escapeHtml(
              loginUrl,
            )}</a>`,
          },
          {
            label: 'Email',
            value: this.escapeHtml(normalizedEmail),
          },
          {
            label: 'Password temporal',
            value: this.escapeHtml(normalizedPassword),
          },
        ],
        outro:
          'Inicia sesion y cambia tu password lo antes posible para asegurar tu cuenta.',
        cta: {
          label: 'Entrar a Leadflow',
          href: loginUrl,
        },
      }),
    });
  }

  private async sendEmail(input: {
    toAddress: string;
    subject: string;
    text: string;
    html?: string | null;
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
            ...(input.html
              ? {
                  Html: {
                    Charset: 'UTF-8',
                    Data: input.html,
                  },
                }
              : {}),
          },
        },
      }),
    );
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

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private buildEmailShell(input: {
    title: string;
    intro: string;
    sections: Array<{
      label: string;
      value: string;
    }>;
    outro: string;
    cta: {
      label: string;
      href: string;
    };
  }) {
    const sections = input.sections
      .map(
        (section) => `
          <tr>
            <td style="padding:0 0 14px 0;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">${this.escapeHtml(
                section.label,
              )}</div>
              <div style="font-size:15px;line-height:1.6;color:#0f172a;">${section.value}</div>
            </td>
          </tr>
        `,
      )
      .join('');

    return `
      <div style="margin:0;padding:32px 16px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <div style="padding:28px 28px 20px 28px;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;margin-bottom:10px;">Leadflow</div>
            <h1 style="margin:0;font-size:24px;line-height:1.3;">${this.escapeHtml(
              input.title,
            )}</h1>
          </div>
          <div style="padding:24px 28px 28px 28px;">
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#334155;">${input.intro}</p>
            <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px 0;">
              ${sections}
            </table>
            <div style="margin:0 0 24px 0;">
              <a href="${this.escapeHtml(
                input.cta.href,
              )}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">${this.escapeHtml(
      input.cta.label,
    )}</a>
            </div>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">${this.escapeHtml(
              input.outro,
            )}</p>
          </div>
        </div>
      </div>
    `;
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
