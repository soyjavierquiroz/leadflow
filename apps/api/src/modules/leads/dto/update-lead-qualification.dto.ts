export class UpdateLeadQualificationDto {
  readonly qualificationGrade?: 'cold' | 'warm' | 'hot' | null;
  readonly summaryText?: string | null;
}
