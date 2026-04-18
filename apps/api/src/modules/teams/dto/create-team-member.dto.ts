export class CreateTeamMemberDto {
  readonly fullName!: string;
  readonly email!: string;
  readonly whatsappNumber!: string;
  readonly isActive?: boolean;
}
