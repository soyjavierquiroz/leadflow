import type { CreateAssignmentDto } from '../dto/create-assignment.dto';
import type {
  BaseDomainEntity,
  DomainId,
  ISODateString,
  RepositoryPort,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type AssignmentStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'reassigned'
  | 'closed';

export type AssignmentReason = 'rotation' | 'manual' | 'fallback' | 'handoff';

export interface Assignment extends BaseDomainEntity, WorkspaceScoped {
  leadId: DomainId;
  sponsorId: DomainId;
  teamId: DomainId;
  funnelId: DomainId;
  funnelInstanceId: DomainId | null;
  funnelPublicationId: DomainId | null;
  rotationPoolId: DomainId | null;
  status: AssignmentStatus;
  reason: AssignmentReason;
  assignedAt: ISODateString;
  acceptedAt: ISODateString | null;
  resolvedAt: ISODateString | null;
}

export interface AssignmentRepository extends RepositoryPort<
  Assignment,
  CreateAssignmentDto
> {
  findAll(): Promise<Assignment[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<Assignment[]>;
  findByTeamId(teamId: DomainId): Promise<Assignment[]>;
  findBySponsorId(sponsorId: DomainId): Promise<Assignment[]>;
  findByPublicationId(funnelPublicationId: DomainId): Promise<Assignment[]>;
  findOpenByLeadId(leadId: DomainId): Promise<Assignment | null>;
}
