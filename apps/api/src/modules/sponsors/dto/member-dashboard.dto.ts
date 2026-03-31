export type MemberDashboardAvailabilityStatus =
  | 'available'
  | 'paused'
  | 'offline';

export type MemberDashboardLeadStatus =
  | 'captured'
  | 'qualified'
  | 'assigned'
  | 'nurturing'
  | 'won'
  | 'lost';

export type MemberDashboardAssignmentStatus = 'assigned' | 'accepted';

export type MemberDashboardReminderBucket =
  | 'overdue'
  | 'due_today'
  | 'upcoming'
  | 'unscheduled'
  | 'none';

export class MemberDashboardSponsorDto {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly availabilityStatus: MemberDashboardAvailabilityStatus;

  constructor(input: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    email: string | null;
    phone: string | null;
    availabilityStatus: MemberDashboardAvailabilityStatus;
  }) {
    this.id = input.id;
    this.displayName = input.displayName;
    this.avatarUrl = input.avatarUrl;
    this.email = input.email;
    this.phone = input.phone;
    this.availabilityStatus = input.availabilityStatus;
  }
}

export class MemberDashboardKpisDto {
  readonly handoffsNew: number;
  readonly actionsToday: number;
  readonly activePortfolio: number;

  constructor(input: {
    handoffsNew: number;
    actionsToday: number;
    activePortfolio: number;
  }) {
    this.handoffsNew = input.handoffsNew;
    this.actionsToday = input.actionsToday;
    this.activePortfolio = input.activePortfolio;
  }
}

export class MemberDashboardLeadDto {
  readonly id: string;
  readonly assignmentId: string;
  readonly leadName: string;
  readonly companyName: string | null;
  readonly contactLabel: string;
  readonly leadStatus: MemberDashboardLeadStatus;
  readonly assignmentStatus: MemberDashboardAssignmentStatus;
  readonly reminderBucket: MemberDashboardReminderBucket;
  readonly reminderLabel: string;
  readonly needsAttention: boolean;
  readonly nextActionLabel: string;
  readonly assignedAt: string;
  readonly followUpAt: string | null;
  readonly publicationPath: string | null;
  readonly domainHost: string | null;
  readonly funnelName: string | null;

  constructor(input: {
    id: string;
    assignmentId: string;
    leadName: string;
    companyName: string | null;
    contactLabel: string;
    leadStatus: MemberDashboardLeadStatus;
    assignmentStatus: MemberDashboardAssignmentStatus;
    reminderBucket: MemberDashboardReminderBucket;
    reminderLabel: string;
    needsAttention: boolean;
    nextActionLabel: string;
    assignedAt: string;
    followUpAt: string | null;
    publicationPath: string | null;
    domainHost: string | null;
    funnelName: string | null;
  }) {
    this.id = input.id;
    this.assignmentId = input.assignmentId;
    this.leadName = input.leadName;
    this.companyName = input.companyName;
    this.contactLabel = input.contactLabel;
    this.leadStatus = input.leadStatus;
    this.assignmentStatus = input.assignmentStatus;
    this.reminderBucket = input.reminderBucket;
    this.reminderLabel = input.reminderLabel;
    this.needsAttention = input.needsAttention;
    this.nextActionLabel = input.nextActionLabel;
    this.assignedAt = input.assignedAt;
    this.followUpAt = input.followUpAt;
    this.publicationPath = input.publicationPath;
    this.domainHost = input.domainHost;
    this.funnelName = input.funnelName;
  }
}

export class MemberDashboardDto {
  readonly sponsor: MemberDashboardSponsorDto;
  readonly kpis: MemberDashboardKpisDto;
  readonly inbox: MemberDashboardLeadDto[];

  constructor(input: {
    sponsor: MemberDashboardSponsorDto;
    kpis: MemberDashboardKpisDto;
    inbox: MemberDashboardLeadDto[];
  }) {
    this.sponsor = input.sponsor;
    this.kpis = input.kpis;
    this.inbox = input.inbox;
  }
}
