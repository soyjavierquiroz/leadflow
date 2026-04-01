import type { AvailabilityStatus } from '../../shared/domain.types';

export class CreateSponsorDto {
  readonly workspaceId!: string;
  readonly teamId!: string;
  readonly displayName!: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly availabilityStatus?: AvailabilityStatus;
  readonly routingWeight?: number;
  readonly memberPortalEnabled?: boolean;
  readonly isActive?: boolean;
}
