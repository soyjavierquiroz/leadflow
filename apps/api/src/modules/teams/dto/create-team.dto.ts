export class CreateTeamDto {
  readonly workspaceId!: string;
  readonly name!: string;
  readonly code!: string;
  readonly isActive?: boolean;
  readonly subscriptionExpiresAt?: string | null;
  readonly description?: string;
  readonly managerUserId?: string | null;
  readonly maxSeats?: number;
}
