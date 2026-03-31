export class UpdateMemberSponsorDto {
  readonly displayName?: string;
  readonly avatarUrl?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly availabilityStatus?: 'available' | 'paused' | 'offline';
}
