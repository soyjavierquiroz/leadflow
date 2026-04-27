import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailClient, type MailDetail } from '@leadflow/mail';

const DEFAULT_LOGIN_URL = 'http://localhost:3000/login';
const LEADFLOW_DASHBOARD_URL = 'https://leadflow.kuruk.in';

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
  }) {
    const normalizedEmail =
      sanitizeNullableText(input.email)?.toLowerCase() ??
      'unknown@leadflow.local';
    const normalizedTeamName = sanitizeNullableText(input.teamName) ?? 'Leadflow';

    await this.mailClient.sendSystemEmail({
      toAddress: normalizedEmail,
      subject: 'Tu licencia de asesor ya fue activada',
      title: 'Tu licencia de asesor ya fue activada',
      paragraphs: [
        `Tu licencia dentro del team "${normalizedTeamName}" ya esta activa.`,
        'Desde este momento puedes operar normalmente dentro de LeadFlow.',
        'Puedes ingresar a tu cuenta por https://leadflow.kuruk.in',
      ],
      action: {
        label: 'Entrar a LeadFlow',
        href: LEADFLOW_DASHBOARD_URL,
      },
      footerNote:
        'Si no reconoces esta activacion, avisa a tu Team Admin de inmediato.',
    });
  }

  async sendAdvisorLeadAssignmentEmail(input: {
    email: string;
    advisorName: string;
    leadName?: string | null;
    leadPhone?: string | null;
    leadEmail?: string | null;
    teamName?: string | null;
    trafficLayer?: string | null;
    assignmentId?: string | null;
  }) {
    const normalizedEmail =
      sanitizeNullableText(input.email)?.toLowerCase() ??
      'unknown@leadflow.local';
    const advisorName = sanitizeNullableText(input.advisorName) ?? 'asesor';
    const leadName = sanitizeNullableText(input.leadName) ?? 'Lead nuevo';
    const teamName = sanitizeNullableText(input.teamName) ?? 'Leadflow';
    const trafficLayer = sanitizeNullableText(input.trafficLayer) ?? 'ORGANIC';
    const leadPhone = sanitizeNullableText(input.leadPhone);
    const leadEmail = sanitizeNullableText(input.leadEmail);
    const assignmentId = sanitizeNullableText(input.assignmentId);
    const loginUrl = this.resolveLoginUrl();
    const details: MailDetail[] = [
      {
        label: 'Lead',
        value: leadName,
      },
      ...(leadPhone
        ? [
            {
              label: 'Telefono',
              value: leadPhone,
            },
          ]
        : []),
      ...(leadEmail
        ? [
            {
              label: 'Email',
              value: leadEmail,
            },
          ]
        : []),
      {
        label: 'Trafico',
        value: trafficLayer,
      },
      ...(assignmentId
        ? [
            {
              label: 'Asignacion',
              value: assignmentId,
            },
          ]
        : []),
    ];

    await this.mailClient.sendSystemEmail({
      toAddress: normalizedEmail,
      subject: 'Tienes un nuevo lead asignado',
      title: 'Tienes un nuevo lead asignado',
      paragraphs: [
        `${advisorName}, recibiste un nuevo lead en el team "${teamName}".`,
        'Revisa el contexto operativo y contactalo lo antes posible.',
      ],
      details,
      action: {
        label: 'Abrir LeadFlow',
        href: loginUrl,
      },
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

  private resolveLoginUrl() {
    return (
      sanitizeNullableText(this.configService.get<string>('ADMIN_URL')) ??
      sanitizeNullableText(this.configService.get<string>('SITE_URL')) ??
      DEFAULT_LOGIN_URL
    );
  }
}
