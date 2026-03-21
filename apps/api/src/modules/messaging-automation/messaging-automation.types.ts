import type {
  AutomationDispatchStatus,
  MessagingConnectionStatus,
} from '@prisma/client';
import type { ISODateString } from '../shared/domain.types';

export type AutomationDispatchView = {
  id: string;
  assignmentId: string;
  leadId: string;
  sponsorId: string;
  triggerType: string;
  status: AutomationDispatchStatus;
  targetWebhookUrl: string | null;
  responseStatusCode: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  queuedAt: ISODateString;
  dispatchedAt: ISODateString | null;
  completedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lead: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    status: string;
  };
};

export type MessagingAutomationReadiness = {
  canDispatch: boolean;
  status: 'ready' | 'blocked';
  blockingReason: string | null;
  targetWebhookUrl: string | null;
  defaultWebhookBaseUrlConfigured: boolean;
  connectionStatus: MessagingConnectionStatus | null;
  note: string | null;
};

export type MessagingAutomationMemberSnapshot = {
  readiness: MessagingAutomationReadiness;
  latestDispatches: AutomationDispatchView[];
};

export type DispatchAssignmentAutomationInput = {
  assignmentId: string;
  triggerType: string;
  triggerEventId?: string | null;
  anonymousId?: string | null;
  currentStepId?: string | null;
  nextStepPath?: string | null;
};
