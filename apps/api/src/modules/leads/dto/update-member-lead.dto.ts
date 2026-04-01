export const memberLeadStatusValues = [
  'qualified',
  'nurturing',
  'won',
  'lost',
] as const;

export type MemberLeadStatus = (typeof memberLeadStatusValues)[number];

export class UpdateMemberLeadDto {
  readonly status?: MemberLeadStatus;
}
