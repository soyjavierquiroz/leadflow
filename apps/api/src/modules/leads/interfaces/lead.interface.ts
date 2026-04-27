import type { CreateLeadDto } from '../dto/create-lead.dto';
import type { LeadPlaybookKey, LeadReminderBucket } from '../leads-workflows';
import type {
  BaseDomainEntity,
  DomainId,
  ISODateString,
  LeadSourceChannel,
  RepositoryPort,
  TrafficLayer,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type LeadStatus =
  | 'captured'
  | 'qualified'
  | 'assigned'
  | 'nurturing'
  | 'won'
  | 'lost';

export type LeadQualificationGrade = 'cold' | 'warm' | 'hot';

export interface Lead extends BaseDomainEntity, WorkspaceScoped {
  funnelId: DomainId;
  funnelInstanceId: DomainId | null;
  funnelPublicationId: DomainId | null;
  trafficLayer: TrafficLayer;
  originAdWheelId: DomainId | null;
  originAdWheelName: string | null;
  visitorId: DomainId | null;
  sourceChannel: LeadSourceChannel;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  status: LeadStatus;
  qualificationGrade: LeadQualificationGrade | null;
  summaryText: string | null;
  nextActionLabel: string | null;
  followUpAt: ISODateString | null;
  lastContactedAt: ISODateString | null;
  lastQualifiedAt: ISODateString | null;
  currentAssignmentId: DomainId | null;
  reminderBucket?: LeadReminderBucket;
  reminderLabel?: string | null;
  suggestedNextAction?: string | null;
  effectiveNextAction?: string | null;
  playbookKey?: LeadPlaybookKey | null;
  playbookTitle?: string | null;
  playbookDescription?: string | null;
  needsAttention?: boolean;
  tags: string[];
}

export interface LeadRepository extends RepositoryPort<Lead, CreateLeadDto> {
  findAll(): Promise<Lead[]>;
  findByVisitorId(visitorId: DomainId): Promise<Lead[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<Lead[]>;
  findByTeamId(teamId: DomainId): Promise<Lead[]>;
  findBySponsorId(sponsorId: DomainId): Promise<Lead[]>;
  findByPublicationId(funnelPublicationId: DomainId): Promise<Lead[]>;
}
