export class UpdateTeamSponsorDto {
  readonly status?: 'active' | 'paused';
  readonly availabilityStatus?: 'available' | 'paused' | 'offline';
}
