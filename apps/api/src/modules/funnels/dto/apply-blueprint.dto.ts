export class ApplyBlueprintDto {
  readonly type!: string;
  readonly mode?: 'replace' | 'merge';
  readonly allowDestructiveOverwrite?: boolean;
}
