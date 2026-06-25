import type { IndividualNicheKey } from '@leadflow/account-model';

export class ProvisionIndividualAccountDto {
  readonly businessName!: string;
  readonly niche?: IndividualNicheKey | string;
  readonly country?: string;
  readonly phone?: string;
}
