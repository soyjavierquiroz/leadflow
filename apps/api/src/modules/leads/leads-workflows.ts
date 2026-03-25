import type { LeadQualificationGrade, LeadStatus } from '@prisma/client';
import type { ISODateString } from '../shared/domain.types';

export type LeadReminderBucket =
  | 'overdue'
  | 'due_today'
  | 'upcoming'
  | 'unscheduled'
  | 'none';

export type LeadPlaybookKey =
  | 'first_contact'
  | 'active_nurture'
  | 'high_intent_close'
  | 'cold_reengage'
  | 'won_handoff'
  | 'lost_recycle';

export type LeadWorkflowInput = {
  status: LeadStatus;
  qualificationGrade: LeadQualificationGrade | null;
  nextActionLabel: string | null;
  followUpAt: ISODateString | null;
  lastContactedAt: ISODateString | null;
  lastQualifiedAt: ISODateString | null;
};

export type LeadReminderView = {
  bucket: LeadReminderBucket;
  label: string;
  followUpAt: ISODateString | null;
  needsAttention: boolean;
  isOverdue: boolean;
  isDueToday: boolean;
  isUpcoming: boolean;
  needsScheduling: boolean;
};

export type LeadPlaybookView = {
  key: LeadPlaybookKey;
  title: string;
  description: string;
  checklist: string[];
  suggestedNextAction: string;
};

export type LeadWorkflowView = {
  reminder: LeadReminderView;
  suggestedNextAction: string;
  effectiveNextAction: string;
  playbook: LeadPlaybookView;
};

const TERMINAL_LEAD_STATUSES = new Set<LeadStatus>(['won', 'lost']);

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toDayNumber = (value: Date) =>
  Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) /
  DAY_IN_MS;

const toValidDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

export const resolveLeadReminder = (
  input: LeadWorkflowInput,
  referenceDate = new Date(),
): LeadReminderView => {
  const followUpDate = toValidDate(input.followUpAt);

  if (TERMINAL_LEAD_STATUSES.has(input.status)) {
    return {
      bucket: 'none',
      label: 'Sin seguimiento activo',
      followUpAt: input.followUpAt,
      needsAttention: false,
      isOverdue: false,
      isDueToday: false,
      isUpcoming: false,
      needsScheduling: false,
    };
  }

  if (!followUpDate) {
    return {
      bucket: 'unscheduled',
      label: 'Sin follow-up',
      followUpAt: null,
      needsAttention: false,
      isOverdue: false,
      isDueToday: false,
      isUpcoming: false,
      needsScheduling: true,
    };
  }

  const followUpDay = toDayNumber(followUpDate);
  const currentDay = toDayNumber(referenceDate);

  if (followUpDay < currentDay) {
    return {
      bucket: 'overdue',
      label: 'Vencido',
      followUpAt: input.followUpAt,
      needsAttention: true,
      isOverdue: true,
      isDueToday: false,
      isUpcoming: false,
      needsScheduling: false,
    };
  }

  if (followUpDay === currentDay) {
    return {
      bucket: 'due_today',
      label: 'Hoy',
      followUpAt: input.followUpAt,
      needsAttention: true,
      isOverdue: false,
      isDueToday: true,
      isUpcoming: false,
      needsScheduling: false,
    };
  }

  return {
    bucket: 'upcoming',
    label: 'Proximo',
    followUpAt: input.followUpAt,
    needsAttention: false,
    isOverdue: false,
    isDueToday: false,
    isUpcoming: true,
    needsScheduling: false,
  };
};

export const resolveLeadPlaybook = (
  input: LeadWorkflowInput,
): LeadPlaybookView => {
  if (input.status === 'won') {
    return {
      key: 'won_handoff',
      title: 'Cierre ganado',
      description:
        'Consolidar el cierre, confirmar el siguiente paso y evitar que el lead quede sin handoff operativo.',
      checklist: [
        'Confirmar decision comercial y responsable siguiente',
        'Enviar mensaje de bienvenida o onboarding',
        'Cerrar seguimiento manual si ya no hay tareas abiertas',
      ],
      suggestedNextAction: 'Confirmar onboarding y dejar cierre documentado.',
    };
  }

  if (input.status === 'lost') {
    return {
      key: 'lost_recycle',
      title: 'Reciclaje de perdida',
      description:
        'Registrar por que se perdio la oportunidad y dejarla lista para reactivacion futura si aplica.',
      checklist: [
        'Registrar razon comercial de perdida',
        'Definir si vuelve a nurturing mas adelante',
        'Limpiar o cerrar follow-up activo si ya no corresponde',
      ],
      suggestedNextAction:
        'Registrar motivo de perdida y definir si entra a reciclaje.',
    };
  }

  if (
    input.status === 'assigned' ||
    (!input.lastContactedAt && !input.qualificationGrade)
  ) {
    return {
      key: 'first_contact',
      title: 'Primer contacto',
      description:
        'La prioridad es tomar ownership del lead rapido y abrir la primera conversacion con contexto.',
      checklist: [
        'Validar datos minimos del lead y origen',
        'Enviar primer mensaje o llamada de contacto',
        'Dejar follow-up concreto si no responde',
      ],
      suggestedNextAction:
        'Hacer primer contacto y dejar follow-up concreto para hoy.',
    };
  }

  if (input.status === 'qualified' || input.qualificationGrade === 'hot') {
    return {
      key: 'high_intent_close',
      title: 'Alta intencion',
      description:
        'Lead con senales de cierre. La operacion debe avanzar hacia llamada, propuesta o siguiente decision comercial.',
      checklist: [
        'Confirmar necesidad y timing',
        'Llevar el lead a llamada, demo o propuesta',
        'Asegurar follow-up corto hasta resolucion',
      ],
      suggestedNextAction:
        'Llevar el lead a llamada o propuesta con seguimiento corto.',
    };
  }

  if (input.qualificationGrade === 'cold') {
    return {
      key: 'cold_reengage',
      title: 'Reactivacion fria',
      description:
        'El lead necesita un reintento liviano y una validacion rapida de timing antes de seguir invirtiendo esfuerzo.',
      checklist: [
        'Reintentar con mensaje corto y directo',
        'Validar si el timing sigue vigente',
        'Si no responde, espaciar el siguiente intento',
      ],
      suggestedNextAction: 'Reactivar con mensaje corto y validar timing real.',
    };
  }

  return {
    key: 'active_nurture',
    title: 'Nurturing activo',
    description:
      'El lead ya entro en conversacion y necesita seguimiento constante sin sobreoperarlo.',
    checklist: [
      'Actualizar resumen con la ultima respuesta',
      'Definir siguiente paso claro',
      'Mantener follow-up visible para no perder timing',
    ],
    suggestedNextAction:
      'Enviar seguimiento con contexto y confirmar el siguiente paso.',
  };
};

export const buildLeadWorkflow = (
  input: LeadWorkflowInput,
  referenceDate = new Date(),
): LeadWorkflowView => {
  const reminder = resolveLeadReminder(input, referenceDate);
  const playbook = resolveLeadPlaybook(input);
  const suggestedNextAction =
    reminder.bucket === 'overdue'
      ? `Resolver follow-up vencido. ${playbook.suggestedNextAction}`
      : reminder.bucket === 'due_today'
        ? `Resolver seguimiento de hoy. ${playbook.suggestedNextAction}`
        : reminder.bucket === 'unscheduled'
          ? `Definir follow-up. ${playbook.suggestedNextAction}`
          : playbook.suggestedNextAction;

  return {
    reminder,
    playbook,
    suggestedNextAction,
    effectiveNextAction: input.nextActionLabel?.trim() || suggestedNextAction,
  };
};
