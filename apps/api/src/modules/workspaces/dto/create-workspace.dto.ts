export class CreateWorkspaceDto {
  readonly name!: string;
  readonly slug!: string;
  readonly timezone?: string;
  readonly defaultCurrency?: string;
  readonly primaryLocale?: string;
  readonly primaryDomain?: string | null;
}
