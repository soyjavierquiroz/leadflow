import type { CreateLeadDto } from '../dto/create-lead.dto';
import type {
  BaseDomainEntity,
  DomainId,
  LeadSourceChannel,
  RepositoryPort,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type LeadStatus =
  | 'captured'
  | 'qualified'
  | 'assigned'
  | 'nurturing'
  | 'won'
  | 'lost';

export interface Lead extends BaseDomainEntity, WorkspaceScoped {
  funnelId: DomainId;
  funnelInstanceId: DomainId | null;
  funnelPublicationId: DomainId | null;
  visitorId: DomainId | null;
  sourceChannel: LeadSourceChannel;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  status: LeadStatus;
  currentAssignmentId: DomainId | null;
  tags: string[];
}

export interface LeadRepository extends RepositoryPort<Lead, CreateLeadDto> {
  findAll(): Promise<Lead[]>;
  findByVisitorId(visitorId: DomainId): Promise<Lead[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<Lead[]>;
}
