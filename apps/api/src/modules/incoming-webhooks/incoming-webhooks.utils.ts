import { timingSafeEqual } from 'crypto';
import type {
  AssignmentStatus,
  ConversationSignalType,
  LeadStatus,
} from '@prisma/client';
import type { ConversationSignalTransition } from './incoming-webhooks.types';

const ENGAGEMENT_SIGNAL_TYPES = new Set<ConversationSignalType>([
  'conversation_started',
  'message_inbound',
  'message_outbound',
  'lead_contacted',
  'lead_follow_up',
]);

export const readIncomingWebhookSecret = (
  headers: Record<string, string | string[] | undefined>,
) => {
  const headerValue = headers['x-leadflow-webhook-secret'];
  const apiKeyHeader = headers['x-api-key'];
  const authorization = headers.authorization;

  const candidate =
    (Array.isArray(headerValue) ? headerValue[0] : headerValue) ??
    (Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader) ??
    null;

  if (candidate?.trim()) {
    return candidate.trim();
  }

  const authValue = Array.isArray(authorization)
    ? authorization[0]
    : authorization;

  if (!authValue?.trim()) {
    return null;
  }

  const match = authValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export const matchesIncomingWebhookSecret = (
  expected: string,
  provided: string | null,
) => {
  if (!provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
};

const toAcceptedAssignmentStatus = (
  status: AssignmentStatus | null,
): AssignmentStatus | null => {
  switch (status) {
    case 'pending':
    case 'assigned':
    case 'reassigned':
      return 'accepted';
    case 'accepted':
    case 'closed':
      return status;
    default:
      return status;
  }
};

const toEngagedLeadStatus = (status: LeadStatus | null): LeadStatus | null => {
  switch (status) {
    case 'captured':
    case 'assigned':
      return 'nurturing';
    case 'qualified':
    case 'nurturing':
    case 'won':
    case 'lost':
      return status;
    default:
      return status;
  }
};

export const resolveConversationSignalTransition = (input: {
  signalType: ConversationSignalType;
  currentLeadStatus: LeadStatus | null;
  currentAssignmentStatus: AssignmentStatus | null;
}): ConversationSignalTransition => {
  if (ENGAGEMENT_SIGNAL_TYPES.has(input.signalType)) {
    return {
      leadStatusAfter: toEngagedLeadStatus(input.currentLeadStatus),
      assignmentStatusAfter: toAcceptedAssignmentStatus(
        input.currentAssignmentStatus,
      ),
    };
  }

  switch (input.signalType) {
    case 'lead_qualified':
      return {
        leadStatusAfter:
          input.currentLeadStatus === 'won' ||
          input.currentLeadStatus === 'lost'
            ? input.currentLeadStatus
            : 'qualified',
        assignmentStatusAfter: toAcceptedAssignmentStatus(
          input.currentAssignmentStatus,
        ),
      };
    case 'lead_won':
      return {
        leadStatusAfter: 'won',
        assignmentStatusAfter: input.currentAssignmentStatus ? 'closed' : null,
      };
    case 'lead_lost':
      return {
        leadStatusAfter: 'lost',
        assignmentStatusAfter: input.currentAssignmentStatus ? 'closed' : null,
      };
    default:
      return {
        leadStatusAfter: input.currentLeadStatus,
        assignmentStatusAfter: input.currentAssignmentStatus,
      };
  }
};

export const parseConversationSignalLimit = (value?: string) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 8;
  }

  return Math.min(parsed, 20);
};
