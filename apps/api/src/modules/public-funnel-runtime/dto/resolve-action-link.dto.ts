export class ResolveActionLinkDto {
  readonly leadId!: string;
  readonly assignmentId?: string | null;
  readonly appKey?: string;
  readonly actionKey!: 'leadflow.open_vsl';
  readonly purpose?: string;
  readonly channel?: string;
  readonly params?: {
    stepKey?: string;
  };
  readonly idempotencyKey?: string | null;
  readonly createdBy?: string | null;
}
