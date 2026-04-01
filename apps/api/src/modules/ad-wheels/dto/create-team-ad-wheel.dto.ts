export class CreateTeamAdWheelDto {
  readonly status!: 'DRAFT' | 'ACTIVE';
  readonly name!: string;
  readonly seatPrice!: number;
  readonly durationDays!: number;
}
