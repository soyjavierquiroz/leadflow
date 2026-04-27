export class CreateTeamAdWheelDto {
  readonly status!: 'DRAFT' | 'ACTIVE';
  readonly publicationId!: string;
  readonly name!: string;
  readonly seatPrice!: number;
  readonly startDate!: string;
  readonly durationDays!: number;
}
