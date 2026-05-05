export class SystemKreditInjectionDto {
  readonly targetType!: 'team' | 'sponsor';
  readonly targetId!: string;
  readonly amountDecimal!: string;
  readonly reason?: string;
  readonly note?: string;
}
