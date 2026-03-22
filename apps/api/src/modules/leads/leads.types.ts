import type {
  AssignmentStatus,
  ConversationSignalProcessingStatus,
  ConversationSignalSource,
  ConversationSignalType,
  EventActorType,
  LeadQualificationGrade,
  LeadStatus,
  UserRole,
} from '@prisma/client';
import type { ISODateString } from '../shared/domain.types';

export type LeadTimelineScope = {
  workspaceId?: string;
  teamId?: string;
  sponsorId?: string;
};

export type LeadNoteView = {
  id: string;
  body: string;
  authorName: string;
  authorRole: UserRole;
  sponsorId: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type LeadTimelineItem =
  | {
      id: string;
      itemType: 'note';
      occurredAt: ISODateString;
      title: string;
      description: string;
      actorLabel: string;
      statusLabel: string | null;
    }
  | {
      id: string;
      itemType: 'signal';
      occurredAt: ISODateString;
      title: string;
      description: string;
      actorLabel: string;
      statusLabel: ConversationSignalProcessingStatus;
      source: ConversationSignalSource;
      signalType: ConversationSignalType;
    }
  | {
      id: string;
      itemType: 'event';
      occurredAt: ISODateString;
      title: string;
      description: string;
      actorLabel: EventActorType;
      statusLabel: string | null;
      eventName: string;
    };

export type LeadTimelineDetail = {
  lead: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    sourceChannel: string;
    status: LeadStatus;
    qualificationGrade: LeadQualificationGrade | null;
    summaryText: string | null;
    nextActionLabel: string | null;
    followUpAt: ISODateString | null;
    lastContactedAt: ISODateString | null;
    lastQualifiedAt: ISODateString | null;
    sponsorId: string | null;
    sponsorName: string | null;
    teamId: string | null;
    teamName: string | null;
    assignmentId: string | null;
    assignmentStatus: AssignmentStatus | null;
    assignedAt: ISODateString | null;
    funnelName: string | null;
    domainHost: string | null;
    publicationPath: string | null;
    createdAt: ISODateString;
    updatedAt: ISODateString;
  };
  notes: LeadNoteView[];
  timeline: LeadTimelineItem[];
};
