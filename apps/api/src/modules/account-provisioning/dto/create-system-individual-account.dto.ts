import type { IndividualNicheKey } from '@leadflow/account-model';

export class CreateSystemIndividualAccountDto {
  readonly name!: string;
  readonly email!: string;
  readonly phone?: string;
  readonly businessName!: string;
  readonly niche?: IndividualNicheKey | string;
  readonly country?: string;
  readonly temporaryPassword?: string;
  readonly sendInviteEmail?: boolean;
}
