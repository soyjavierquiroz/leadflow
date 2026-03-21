import type { DomainKind } from '../../shared/domain.types';

export class CreateDomainDto {
  readonly workspaceId!: string;
  readonly teamId!: string;
  readonly host!: string;
  readonly kind?: DomainKind;
  readonly isPrimary?: boolean;
}
