export class AddKurukinBlacklistEntryDto {
  readonly blockedPhone!: string;
  readonly reason?: string | null;
  readonly label?: string | null;
}
