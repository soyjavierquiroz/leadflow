export class UpdateMemberAssignmentDto {
  readonly status?: 'accepted' | 'closed';
  readonly leadStatus?: 'qualified' | 'nurturing' | 'won' | 'lost';
}
