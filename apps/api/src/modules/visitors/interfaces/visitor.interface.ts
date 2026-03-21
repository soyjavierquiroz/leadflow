import type { CreateVisitorDto } from '../dto/create-visitor.dto';
import type {
  BaseDomainEntity,
  DomainId,
  ISODateString,
  LeadSourceChannel,
  RepositoryPort,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type VisitorStatus = 'active' | 'converted' | 'archived';
export type VisitorKind = 'anonymous' | 'identified';

export interface Visitor extends BaseDomainEntity, WorkspaceScoped {
  anonymousId: string;
  kind: VisitorKind;
  status: VisitorStatus;
  sourceChannel: LeadSourceChannel;
  leadId: DomainId | null;
  firstSeenAt: ISODateString;
  lastSeenAt: ISODateString;
  utmSource: string | null;
  utmCampaign: string | null;
}

export interface VisitorRepository extends RepositoryPort<
  Visitor,
  CreateVisitorDto
> {
  findByAnonymousId(
    workspaceId: DomainId,
    anonymousId: string,
  ): Promise<Visitor | null>;
}
