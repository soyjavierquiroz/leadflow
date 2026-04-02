import type {
  DomainType,
  DomainVerificationMethod,
} from '../../shared/domain.types';

export class CreateTeamDomainDto {
  readonly linkedFunnelId?: string | null;
  readonly host!: string;
  readonly domainType?: DomainType;
  readonly isPrimary?: boolean;
  readonly canonicalHost?: string | null;
  readonly redirectToPrimary?: boolean;
  readonly verificationMethod?: DomainVerificationMethod;
}
