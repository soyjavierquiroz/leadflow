export class CreateTeamDto {
  readonly workspaceId!: string;
  readonly name!: string;
  readonly code!: string;
  readonly description?: string;
  readonly managerUserId?: string | null;
  readonly maxSeats?: number;
}
