export class UpdateMemberSponsorDto {
  readonly displayName?: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly availabilityStatus?: 'available' | 'paused' | 'offline';
}
