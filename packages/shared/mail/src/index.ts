import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export const BRAND_FROM_NAME = 'Kurukin LeadFlow';

type NullableString = string | null | undefined;

export type MailEnvironment =
  | Record<string, NullableString>
  | {
      get(key: string): NullableString;
    };

type MailEnvironmentGetter = {
  get(key: string): NullableString;
};

export type MailLogger = {
  warn(message: string): void;
};

export type MailAction = {
  label: string;
  href: string;
};

export type MailDetail = {
  label: string;
  value: string;
  href?: string | null;
};

export type SendAuthEmailInput = {
  toAddress: string;
  subject: string;
  title: string;
  paragraphs: string[];
  action: MailAction;
  securityNote?: string | null;
};

export type SendSystemEmailInput = {
  toAddress: string;
  subject: string;
  title: string;
  paragraphs: string[];
  details?: MailDetail[];
  action?: MailAction | null;
  footerNote?: string | null;
};

type SesSender = {
  send(command: SendEmailCommand): Promise<unknown>;
};

export type MailClientOptions = {
  env?: MailEnvironment;
  logger?: MailLogger;
  sesClient?: SesSender;
};

type RenderedEmail = {
  html: string;
  text: string;
};

const LEGAL_FOOTER =
  'Kurukin LeadFlow es una plataforma operada por Kurukin. Recibes este correo por una accion o notificacion asociada a tu cuenta. Si no reconoces esta actividad, contacta al administrador de tu agencia.';

const sanitizeNullableText = (value: NullableString) => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
};

const sanitizeHeaderText = (value: string) =>
  value.replace(/[<>\r\n]/g, ' ').replace(/\s+/g, ' ').trim();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const hasEnvironmentGetter = (
  env: MailEnvironment,
): env is MailEnvironmentGetter => {
  const getter = (env as { get?: unknown }).get;

  return typeof getter === 'function';
};

const readEnvValue = (
  env: MailEnvironment | undefined,
  key: string,
): string | null => {
  if (!env) {
    return sanitizeNullableText(process.env[key]);
  }

  if (hasEnvironmentGetter(env)) {
    return sanitizeNullableText(env.get(key));
  }

  return sanitizeNullableText((env as Record<string, NullableString>)[key]);
};

const renderParagraphs = (paragraphs: string[]) =>
  paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">${escapeHtml(
          paragraph,
        )}</p>`,
    )
    .join('');

const renderDetails = (details: MailDetail[] | undefined) => {
  if (!details?.length) {
    return '';
  }

  const rows = details
    .map((detail) => {
      const href = sanitizeNullableText(detail.href);
      const value = href
        ? `<a href="${escapeHtml(href)}" style="color:#67E8F9;text-decoration:none;">${escapeHtml(
            detail.value,
          )}</a>`
        : escapeHtml(detail.value);

      return `
        <tr>
          <td style="padding:0 0 14px;">
            <div style="margin:0 0 5px;color:#67E8F9;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(
              detail.label,
            )}</div>
            <div style="color:#e2e8f0;font-size:15px;line-height:1.6;word-break:break-word;">${value}</div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:4px 0 18px;">
      ${rows}
    </table>
  `;
};

const renderAction = (action: MailAction | null | undefined) => {
  if (!action) {
    return '';
  }

  return `
    <div style="margin:8px 0 24px;">
      <a href="${escapeHtml(
        action.href,
      )}" style="display:inline-block;border-radius:14px;background:#67E8F9;color:#020617;padding:14px 18px;font-size:14px;font-weight:800;text-decoration:none;">${escapeHtml(
    action.label,
  )}</a>
      <p style="margin:14px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">Si el boton no funciona, abre este enlace:<br><a href="${escapeHtml(
        action.href,
      )}" style="color:#67E8F9;text-decoration:none;word-break:break-word;">${escapeHtml(
    action.href,
  )}</a></p>
    </div>
  `;
};

const renderBaseLayout = (input: {
  title: string;
  preheader: string;
  paragraphs: string[];
  details?: MailDetail[];
  action?: MailAction | null;
  footerNote?: string | null;
}) => {
  const footerNote = sanitizeNullableText(input.footerNote);

  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtml(input.title)}</title>`,
    '</head>',
    '<body style="margin:0;padding:0;background:#020617;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e2e8f0;">',
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
      input.preheader,
    )}</div>`,
    '<table role="presentation" style="width:100%;border-collapse:collapse;background:#020617;" cellpadding="0" cellspacing="0">',
    '<tr>',
    '<td style="padding:36px 16px;">',
    '<table role="presentation" style="width:100%;max-width:604px;margin:0 auto;border-collapse:collapse;" cellpadding="0" cellspacing="0">',
    '<tr>',
    '<td style="padding:1px;border-radius:24px;background:linear-gradient(135deg,rgba(103,232,249,0.7),rgba(148,163,184,0.16),rgba(15,23,42,0.2));">',
    '<table role="presentation" style="width:100%;border-collapse:collapse;border-radius:23px;overflow:hidden;background:#0f172a;" cellpadding="0" cellspacing="0">',
    '<tr>',
    '<td style="padding:30px 30px 22px;border-bottom:1px solid rgba(148,163,184,0.18);">',
    '<table role="presentation" style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">',
    '<tr>',
    '<td style="vertical-align:middle;">',
    '<div style="width:44px;height:44px;border-radius:13px;background:#67E8F9;color:#020617;font-size:16px;font-weight:900;line-height:44px;text-align:center;letter-spacing:0.02em;">LF</div>',
    '</td>',
    '<td style="vertical-align:middle;text-align:right;">',
    '<div style="color:#67E8F9;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">Kurukin LeadFlow</div>',
    '</td>',
    '</tr>',
    '</table>',
    `<h1 style="margin:26px 0 0;color:#ffffff;font-size:28px;line-height:1.18;font-weight:800;letter-spacing:0;">${escapeHtml(
      input.title,
    )}</h1>`,
    '</td>',
    '</tr>',
    '<tr>',
    '<td style="padding:28px 30px 30px;background:#0b1120;">',
    renderParagraphs(input.paragraphs),
    renderDetails(input.details),
    renderAction(input.action),
    footerNote
      ? `<p style="margin:0 0 18px;color:#94a3b8;font-size:13px;line-height:1.65;">${escapeHtml(
          footerNote,
        )}</p>`
      : '',
    '</td>',
    '</tr>',
    '<tr>',
    '<td style="padding:22px 30px;background:#020617;border-top:1px solid rgba(148,163,184,0.14);">',
    `<p style="margin:0;color:#64748b;font-size:12px;line-height:1.65;">${escapeHtml(
      LEGAL_FOOTER,
    )}</p>`,
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('');
};

const renderText = (input: {
  title: string;
  paragraphs: string[];
  details?: MailDetail[];
  action?: MailAction | null;
  footerNote?: string | null;
}) => {
  const lines = [input.title, '', ...input.paragraphs];

  if (input.details?.length) {
    lines.push('');
    for (const detail of input.details) {
      lines.push(`${detail.label}: ${detail.value}`);
      if (detail.href && detail.href !== detail.value) {
        lines.push(`${detail.label} URL: ${detail.href}`);
      }
    }
  }

  if (input.action) {
    lines.push('', `${input.action.label}: ${input.action.href}`);
  }

  if (input.footerNote) {
    lines.push('', input.footerNote);
  }

  lines.push('', LEGAL_FOOTER);

  return lines.join('\n');
};

const renderEmail = (input: {
  title: string;
  preheader: string;
  paragraphs: string[];
  details?: MailDetail[];
  action?: MailAction | null;
  footerNote?: string | null;
}): RenderedEmail => ({
  html: renderBaseLayout(input),
  text: renderText(input),
});

export class MailClient {
  private sesClient: SesSender | null = null;
  private sesClientResolved = false;

  constructor(private readonly options: MailClientOptions = {}) {}

  async sendAuthEmail(input: SendAuthEmailInput) {
    const rendered = renderEmail({
      title: input.title,
      preheader: input.paragraphs[0] ?? input.title,
      paragraphs: input.paragraphs,
      action: input.action,
      footerNote: input.securityNote,
    });

    await this.sendEmail({
      toAddress: input.toAddress,
      subject: input.subject,
      ...rendered,
    });
  }

  async sendSystemEmail(input: SendSystemEmailInput) {
    const rendered = renderEmail({
      title: input.title,
      preheader: input.paragraphs[0] ?? input.title,
      paragraphs: input.paragraphs,
      details: input.details,
      action: input.action,
      footerNote: input.footerNote,
    });

    await this.sendEmail({
      toAddress: input.toAddress,
      subject: input.subject,
      ...rendered,
    });
  }

  private async sendEmail(input: {
    toAddress: string;
    subject: string;
    html: string;
    text: string;
  }) {
    const toAddress = sanitizeNullableText(input.toAddress)?.toLowerCase();

    if (!toAddress) {
      throw new Error('Email delivery requires a recipient address.');
    }

    const client = this.resolveSesClient();
    const source = this.resolveSourceAddress();

    if (!client || !source) {
      this.warn(
        `SES mail skipped for ${toAddress}: AWS SES or MAIL_FROM_ADDRESS is not fully configured.`,
      );
      return;
    }

    const replyToAddress = this.resolveReplyToAddress();

    await client.send(
      new SendEmailCommand({
        Destination: {
          ToAddresses: [toAddress],
        },
        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: input.html,
            },
            Text: {
              Charset: 'UTF-8',
              Data: input.text,
            },
          },
          Subject: {
            Charset: 'UTF-8',
            Data: input.subject,
          },
        },
        Source: source,
        ...(replyToAddress ? { ReplyToAddresses: [replyToAddress] } : {}),
      }),
    );
  }

  private resolveSesClient() {
    if (this.options.sesClient) {
      return this.options.sesClient;
    }

    if (this.sesClientResolved) {
      return this.sesClient;
    }

    this.sesClientResolved = true;

    const region =
      readEnvValue(this.options.env, 'AWS_REGION') ??
      readEnvValue(this.options.env, 'AWS_DEFAULT_REGION');
    const accessKeyId = readEnvValue(this.options.env, 'AWS_ACCESS_KEY_ID');
    const secretAccessKey = readEnvValue(
      this.options.env,
      'AWS_SECRET_ACCESS_KEY',
    );
    const sessionToken = readEnvValue(this.options.env, 'AWS_SESSION_TOKEN');

    if (!region || !accessKeyId || !secretAccessKey) {
      this.sesClient = null;
      return this.sesClient;
    }

    this.sesClient = new SESClient({
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
      region,
    });

    return this.sesClient;
  }

  private resolveSourceAddress() {
    const fromAddress = readEnvValue(this.options.env, 'MAIL_FROM_ADDRESS');

    if (!fromAddress) {
      return null;
    }

    const fromName =
      readEnvValue(this.options.env, 'MAIL_FROM_NAME') ?? BRAND_FROM_NAME;

    return `${sanitizeHeaderText(fromName)} <${sanitizeHeaderText(fromAddress)}>`;
  }

  private resolveReplyToAddress() {
    return (
      readEnvValue(this.options.env, 'MAIL_REPLY_TO_ADDRESS') ??
      readEnvValue(this.options.env, 'MAIL_FROM_ADDRESS')
    );
  }

  private warn(message: string) {
    if (this.options.logger) {
      this.options.logger.warn(message);
      return;
    }

    console.warn(message);
  }
}

const defaultMailClient = new MailClient();

export const sendAuthEmail = (input: SendAuthEmailInput) =>
  defaultMailClient.sendAuthEmail(input);

export const sendSystemEmail = (input: SendSystemEmailInput) =>
  defaultMailClient.sendSystemEmail(input);
