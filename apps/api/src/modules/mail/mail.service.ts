import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket, connect as createTcpConnection } from 'node:net';
import { TLSSocket, connect as createTlsConnection } from 'node:tls';

type WelcomeEmailPayload = {
  fromEmail: string;
  fromName: string;
  subject: string;
  text: string;
};

type ResolvedMailTransport =
  | {
      kind: 'smtp';
      url: URL;
      fromEmail: string;
      fromName: string;
    }
  | {
      kind: 'resend';
      apiKey: string;
      fromEmail: string;
      fromName: string;
    }
  | {
      kind: 'sendgrid';
      apiKey: string;
      fromEmail: string;
      fromName: string;
    };

type SmtpResponse = {
  code: number;
  message: string;
};

type SmtpStreamState = {
  socket: Socket | TLSSocket;
  buffer: string;
  queuedResponses: SmtpResponse[];
  waitingResolvers: Array<{
    resolve: (response: SmtpResponse) => void;
    reject: (error: Error) => void;
  }>;
  terminalError: Error | null;
};

const DEFAULT_FROM_EMAIL = 'no-reply@leadflow.local';
const DEFAULT_FROM_NAME = 'Leadflow';
const DEFAULT_ADMIN_URL = 'http://localhost:3000/login';
const SMTP_SUCCESS_CODES = [250, 251];
const SMTP_AUTH_SUCCESS_CODES = [235];
const SMTP_READY_CODE = [220];
const SMTP_INTERMEDIATE_CODE = [334];
const SMTP_MESSAGE_END_CODE = [354];

const sanitizeNullableText = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const escapeSmtpData = (value: string) =>
  value
    .replace(/\r?\n/g, '\r\n')
    .replace(/^\./gm, '..');

const formatFromHeader = (name: string, email: string) =>
  `${name} <${email}>`;

const extractCompleteSmtpResponse = (buffer: string) => {
  let cursor = 0;
  let responseCode: string | null = null;
  const responseLines: string[] = [];

  while (cursor < buffer.length) {
    const lineBreakIndex = buffer.indexOf('\r\n', cursor);

    if (lineBreakIndex === -1) {
      return null;
    }

    const line = buffer.slice(cursor, lineBreakIndex);

    if (!/^\d{3}[ -]/.test(line)) {
      return null;
    }

    const currentCode = line.slice(0, 3);
    responseCode ??= currentCode;
    responseLines.push(line);
    cursor = lineBreakIndex + 2;

    if (line[3] === ' ') {
      return {
        response: {
          code: Number(responseCode),
          message: responseLines.map((entry) => entry.slice(4)).join('\n'),
        },
        remainingBuffer: buffer.slice(cursor),
      };
    }
  }

  return null;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendWelcomeEmail(
    email: string,
    plainPassword: string,
    teamName: string,
  ) {
    const normalizedEmail =
      sanitizeNullableText(email)?.toLowerCase() ?? 'unknown@leadflow.local';
    const normalizedTeamName = sanitizeNullableText(teamName) ?? 'Leadflow';
    const normalizedPassword = sanitizeNullableText(plainPassword) ?? '';
    const payload = this.buildWelcomeEmailPayload(
      normalizedEmail,
      normalizedPassword,
      normalizedTeamName,
    );
    let transport: ResolvedMailTransport | null;

    try {
      transport = this.resolveTransport(payload.fromEmail, payload.fromName);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'mail transport resolution failed';

      this.logger.warn(
        `Welcome email transport configuration is invalid: ${detail}`,
      );
      this.logCredentialFallback(
        normalizedEmail,
        normalizedPassword,
        normalizedTeamName,
        `Mail transport configuration is invalid (${detail}).`,
      );
      return;
    }

    if (!transport) {
      this.logCredentialFallback(
        normalizedEmail,
        normalizedPassword,
        normalizedTeamName,
        'No mail transport is configured.',
      );
      return;
    }

    try {
      switch (transport.kind) {
        case 'smtp':
          await this.sendViaSmtp(transport, normalizedEmail, payload);
          break;
        case 'resend':
          await this.sendViaResend(transport, normalizedEmail, payload);
          break;
        case 'sendgrid':
          await this.sendViaSendgrid(transport, normalizedEmail, payload);
          break;
      }

      this.logger.log(
        `Welcome email delivered to ${normalizedEmail} using ${transport.kind}.`,
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'unknown delivery error';

      this.logger.warn(
        `Welcome email delivery failed for ${normalizedEmail}: ${detail}`,
      );
      this.logCredentialFallback(
        normalizedEmail,
        normalizedPassword,
        normalizedTeamName,
        `Mail delivery failed (${transport.kind}).`,
      );
    }
  }

  private buildWelcomeEmailPayload(
    email: string,
    plainPassword: string,
    teamName: string,
  ): WelcomeEmailPayload {
    const adminUrl =
      sanitizeNullableText(this.configService.get<string>('ADMIN_URL')) ??
      sanitizeNullableText(this.configService.get<string>('SITE_URL')) ??
      DEFAULT_ADMIN_URL;

    return {
      fromEmail:
        sanitizeNullableText(this.configService.get<string>('SMTP_FROM_EMAIL')) ??
        sanitizeNullableText(
          this.configService.get<string>('RESEND_FROM_EMAIL'),
        ) ??
        sanitizeNullableText(
          this.configService.get<string>('SENDGRID_FROM_EMAIL'),
        ) ??
        DEFAULT_FROM_EMAIL,
      fromName:
        sanitizeNullableText(this.configService.get<string>('SMTP_FROM_NAME')) ??
        sanitizeNullableText(
          this.configService.get<string>('RESEND_FROM_NAME'),
        ) ??
        sanitizeNullableText(
          this.configService.get<string>('SENDGRID_FROM_NAME'),
        ) ??
        DEFAULT_FROM_NAME,
      subject: 'Your Leadflow access is ready',
      text: [
        'Hello,',
        '',
        `Your Leadflow agency "${teamName}" is ready.`,
        '',
        `Login URL: ${adminUrl}`,
        `Email: ${email}`,
        `Temporary password: ${plainPassword}`,
        '',
        'Please sign in and change your password as soon as possible.',
      ].join('\n'),
    };
  }

  private resolveTransport(
    defaultFromEmail: string,
    defaultFromName: string,
  ): ResolvedMailTransport | null {
    const smtpUrl = sanitizeNullableText(
      this.configService.get<string>('SMTP_URL'),
    );

    if (smtpUrl) {
      return {
        kind: 'smtp',
        url: new URL(smtpUrl),
        fromEmail: defaultFromEmail,
        fromName: defaultFromName,
      };
    }

    const resendApiKey = sanitizeNullableText(
      this.configService.get<string>('RESEND_API_KEY'),
    );
    const resendFromEmail = sanitizeNullableText(
      this.configService.get<string>('RESEND_FROM_EMAIL'),
    );

    if (resendApiKey && resendFromEmail) {
      return {
        kind: 'resend',
        apiKey: resendApiKey,
        fromEmail: resendFromEmail,
        fromName:
          sanitizeNullableText(
            this.configService.get<string>('RESEND_FROM_NAME'),
          ) ?? defaultFromName,
      };
    }

    const sendgridApiKey = sanitizeNullableText(
      this.configService.get<string>('SENDGRID_API_KEY'),
    );
    const sendgridFromEmail = sanitizeNullableText(
      this.configService.get<string>('SENDGRID_FROM_EMAIL'),
    );

    if (sendgridApiKey && sendgridFromEmail) {
      return {
        kind: 'sendgrid',
        apiKey: sendgridApiKey,
        fromEmail: sendgridFromEmail,
        fromName:
          sanitizeNullableText(
            this.configService.get<string>('SENDGRID_FROM_NAME'),
          ) ?? defaultFromName,
      };
    }

    return null;
  }

  private async sendViaResend(
    transport: Extract<ResolvedMailTransport, { kind: 'resend' }>,
    recipientEmail: string,
    payload: WelcomeEmailPayload,
  ) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${transport.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: formatFromHeader(transport.fromName, transport.fromEmail),
        to: [recipientEmail],
        subject: payload.subject,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Resend returned ${response.status}: ${await response.text()}`,
      );
    }
  }

  private async sendViaSendgrid(
    transport: Extract<ResolvedMailTransport, { kind: 'sendgrid' }>,
    recipientEmail: string,
    payload: WelcomeEmailPayload,
  ) {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${transport.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: recipientEmail }],
            subject: payload.subject,
          },
        ],
        from: {
          email: transport.fromEmail,
          name: transport.fromName,
        },
        content: [
          {
            type: 'text/plain',
            value: payload.text,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `SendGrid returned ${response.status}: ${await response.text()}`,
      );
    }
  }

  private async sendViaSmtp(
    transport: Extract<ResolvedMailTransport, { kind: 'smtp' }>,
    recipientEmail: string,
    payload: WelcomeEmailPayload,
  ) {
    const secureProtocol = transport.url.protocol === 'smtps:';

    if (transport.url.protocol !== 'smtp:' && transport.url.protocol !== 'smtps:') {
      throw new Error('SMTP_URL must use smtp:// or smtps://.');
    }

    const username = decodeURIComponent(transport.url.username);
    const password = decodeURIComponent(transport.url.password);
    const host = transport.url.hostname;
    const portValue = transport.url.port
      ? Number(transport.url.port)
      : secureProtocol
        ? 465
        : 587;

    if (!host || !Number.isInteger(portValue) || portValue <= 0) {
      throw new Error('SMTP_URL is missing a valid host or port.');
    }

    const clientHostname =
      sanitizeNullableText(this.configService.get<string>('APP_BASE_DOMAIN')) ??
      'leadflow.local';
    const smtpState = await this.createSmtpStream(host, portValue, secureProtocol);

    try {
      await this.readSmtpResponse(smtpState, SMTP_READY_CODE);
      let ehloResponse = await this.sendSmtpCommand(
        smtpState,
        `EHLO ${clientHostname}`,
        SMTP_SUCCESS_CODES,
      );

      if (!secureProtocol && /STARTTLS/im.test(ehloResponse.message)) {
        await this.sendSmtpCommand(smtpState, 'STARTTLS', SMTP_READY_CODE);
        await this.upgradeSmtpStreamToTls(smtpState, host);
        ehloResponse = await this.sendSmtpCommand(
          smtpState,
          `EHLO ${clientHostname}`,
          SMTP_SUCCESS_CODES,
        );
      }

      if (username) {
        if (/AUTH[^\n]*PLAIN/im.test(ehloResponse.message)) {
          const authToken = Buffer.from(
            `\u0000${username}\u0000${password}`,
            'utf8',
          ).toString('base64');
          await this.sendSmtpCommand(
            smtpState,
            `AUTH PLAIN ${authToken}`,
            SMTP_AUTH_SUCCESS_CODES,
          );
        } else if (/AUTH[^\n]*LOGIN/im.test(ehloResponse.message)) {
          await this.sendSmtpCommand(
            smtpState,
            'AUTH LOGIN',
            SMTP_INTERMEDIATE_CODE,
          );
          await this.sendSmtpCommand(
            smtpState,
            Buffer.from(username, 'utf8').toString('base64'),
            SMTP_INTERMEDIATE_CODE,
          );
          await this.sendSmtpCommand(
            smtpState,
            Buffer.from(password, 'utf8').toString('base64'),
            SMTP_AUTH_SUCCESS_CODES,
          );
        } else {
          throw new Error('SMTP server does not advertise a supported AUTH method.');
        }
      }

      await this.sendSmtpCommand(
        smtpState,
        `MAIL FROM:<${transport.fromEmail}>`,
        SMTP_SUCCESS_CODES,
      );
      await this.sendSmtpCommand(
        smtpState,
        `RCPT TO:<${recipientEmail}>`,
        SMTP_SUCCESS_CODES,
      );
      await this.sendSmtpCommand(smtpState, 'DATA', SMTP_MESSAGE_END_CODE);

      const fromHeader = formatFromHeader(transport.fromName, transport.fromEmail);
      const message = [
        `From: ${fromHeader}`,
        `To: ${recipientEmail}`,
        `Subject: ${payload.subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        payload.text,
      ].join('\r\n');

      smtpState.socket.write(`${escapeSmtpData(message)}\r\n.\r\n`);
      await this.readSmtpResponse(smtpState, SMTP_SUCCESS_CODES);
      await this.sendSmtpCommand(smtpState, 'QUIT', [221]);
    } finally {
      smtpState.socket.destroy();
    }
  }

  private async createSmtpStream(
    host: string,
    port: number,
    secure: boolean,
  ): Promise<SmtpStreamState> {
    const socket = await new Promise<Socket | TLSSocket>((resolve, reject) => {
      const onError = (error: Error) => {
        reject(error);
      };
      const connection = secure
        ? createTlsConnection(
            {
              host,
              port,
              servername: host,
            },
            () => {
              connection.off('error', onError);
              resolve(connection);
            },
          )
        : createTcpConnection(
            {
              host,
              port,
            },
            () => {
              connection.off('error', onError);
              resolve(connection);
            },
          );

      connection.once('error', onError);
    });

    return this.attachSmtpStream(socket);
  }

  private attachSmtpStream(socket: Socket | TLSSocket): SmtpStreamState {
    const state: SmtpStreamState = {
      socket,
      buffer: '',
      queuedResponses: [],
      waitingResolvers: [],
      terminalError: null,
    };

    this.bindSmtpStreamListeners(state);
    return state;
  }

  private bindSmtpStreamListeners(state: SmtpStreamState) {
    const { socket } = state;

    socket.setEncoding('utf8');
    socket.on('data', (chunk: string | Buffer) => {
      state.buffer += chunk.toString();
      this.flushSmtpResponses(state);
    });
    socket.on('error', (error: Error) => {
      state.terminalError = error;
      this.rejectPendingSmtpReaders(state, error);
    });
    socket.on('close', () => {
      if (state.terminalError) {
        return;
      }

      const error = new Error('SMTP connection closed unexpectedly.');
      state.terminalError = error;
      this.rejectPendingSmtpReaders(state, error);
    });
  }

  private flushSmtpResponses(state: SmtpStreamState) {
    while (true) {
      const extracted = extractCompleteSmtpResponse(state.buffer);

      if (!extracted) {
        return;
      }

      state.buffer = extracted.remainingBuffer;

      if (state.waitingResolvers.length > 0) {
        const pending = state.waitingResolvers.shift();
        pending?.resolve(extracted.response);
        continue;
      }

      state.queuedResponses.push(extracted.response);
    }
  }

  private rejectPendingSmtpReaders(state: SmtpStreamState, error: Error) {
    while (state.waitingResolvers.length > 0) {
      const pending = state.waitingResolvers.shift();
      pending?.reject(error);
    }
  }

  private async readSmtpResponse(
    state: SmtpStreamState,
    expectedCodes?: number[],
  ) {
    const response =
      state.queuedResponses.shift() ??
      (await new Promise<SmtpResponse>((resolve, reject) => {
        if (state.terminalError) {
          reject(state.terminalError);
          return;
        }

        state.waitingResolvers.push({ resolve, reject });
      }));

    if (expectedCodes && !expectedCodes.includes(response.code)) {
      throw new Error(
        `Unexpected SMTP response ${response.code}: ${response.message}`,
      );
    }

    return response;
  }

  private async sendSmtpCommand(
    state: SmtpStreamState,
    command: string,
    expectedCodes: number[],
  ) {
    state.socket.write(`${command}\r\n`);
    return await this.readSmtpResponse(state, expectedCodes);
  }

  private async upgradeSmtpStreamToTls(state: SmtpStreamState, host: string) {
    state.socket.removeAllListeners('data');
    state.socket.removeAllListeners('error');
    state.socket.removeAllListeners('close');

    const tlsSocket = await new Promise<TLSSocket>((resolve, reject) => {
      const connection = createTlsConnection(
        {
          socket: state.socket as Socket,
          servername: host,
        },
        () => {
          connection.off('error', onError);
          resolve(connection);
        },
      );

      const onError = (error: Error) => {
        reject(error);
      };

      connection.once('error', onError);
    });

    state.socket = tlsSocket;
    state.buffer = '';
    state.queuedResponses = [];
    state.waitingResolvers = [];
    state.terminalError = null;
    this.bindSmtpStreamListeners(state);
  }

  private logCredentialFallback(
    email: string,
    plainPassword: string,
    teamName: string,
    reason: string,
  ) {
    console.log('\n========================================');
    console.log('LEADFLOW WELCOME EMAIL FALLBACK');
    console.log('========================================');
    console.log(`Reason: ${reason}`);
    console.log(`Agency: ${teamName}`);
    console.log(`Email: ${email}`);
    console.log(`Temporary password: ${plainPassword}`);
    console.log('========================================\n');
  }
}
