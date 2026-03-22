import type {
  AssignmentStatus,
  ConversationSignalProcessingStatus,
  ConversationSignalSource,
  ConversationSignalType,
  LeadStatus,
} from '@prisma/client';
import type { ISODateString } from '../shared/domain.types';

export type ConversationSignalView = {
  id: string;
  workspaceId: string;
  teamId: string;
  sponsorId: string | null;
  leadId: string | null;
  assignmentId: string | null;
  messagingConnectionId: string | null;
  automationDispatchId: string | null;
  source: ConversationSignalSource;
  signalType: ConversationSignalType;
  processingStatus: ConversationSignalProcessingStatus;
  externalEventId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  leadStatusAfter: LeadStatus | null;
  assignmentStatusAfter: AssignmentStatus | null;
  occurredAt: ISODateString;
  processedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type LeadConversationSignalScope = {
  workspaceId?: string;
  teamId?: string;
  sponsorId?: string;
};

export type ConversationSignalTransition = {
  leadStatusAfter: LeadStatus | null;
  assignmentStatusAfter: AssignmentStatus | null;
};
