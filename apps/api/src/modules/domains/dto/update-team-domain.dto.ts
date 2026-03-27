import type { DomainStatus } from '../interfaces/domain.interface';
import type {
  DomainType,
  DomainVerificationMethod,
} from '../../shared/domain.types';

export class UpdateTeamDomainDto {
  readonly host?: string;
  readonly domainType?: DomainType;
  readonly isPrimary?: boolean;
  readonly canonicalHost?: string | null;
  readonly redirectToPrimary?: boolean;
  readonly verificationMethod?: DomainVerificationMethod;
  readonly status?: DomainStatus;
}
