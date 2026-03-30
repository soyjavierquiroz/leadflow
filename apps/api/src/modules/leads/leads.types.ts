import type {
  AssignmentStatus,
  EventActorType,
  LeadQualificationGrade,
  LeadStatus,
  UserRole,
} from '@prisma/client';
import type { ISODateString } from '../shared/domain.types';
import type { LeadPlaybookKey, LeadReminderBucket } from './leads-workflows';

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
      itemType: 'event';
      occurredAt: ISODateString;
      title: string;
      description: string;
      actorLabel: EventActorType;
      statusLabel: string | null;
      eventName: string;
    };

export type LeadWorkflowView = {
  reminder: {
    bucket: LeadReminderBucket;
    label: string;
    followUpAt: ISODateString | null;
    needsAttention: boolean;
    isOverdue: boolean;
    isDueToday: boolean;
    isUpcoming: boolean;
    needsScheduling: boolean;
  };
  suggestedNextAction: string;
  effectiveNextAction: string;
  playbook: {
    key: LeadPlaybookKey;
    title: string;
    description: string;
    checklist: string[];
    suggestedNextAction: string;
  };
};

export type LeadReminderSummary = {
  generatedAt: ISODateString;
  totals: {
    active: number;
    overdue: number;
    dueToday: number;
    upcoming: number;
    unscheduled: number;
    needsAttention: number;
  };
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
  workflow: LeadWorkflowView;
  notes: LeadNoteView[];
  timeline: LeadTimelineItem[];
};
