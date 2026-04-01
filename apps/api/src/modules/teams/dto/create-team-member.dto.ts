export class CreateTeamMemberDto {
  readonly fullName!: string;
  readonly email!: string;
  readonly isActive?: boolean;
}
