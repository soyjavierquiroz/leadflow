export class CreateAssignmentDto {
  readonly workspaceId!: string;
  readonly leadId!: string;
  readonly sponsorId!: string;
  readonly teamId!: string;
  readonly funnelId!: string;
  readonly rotationPoolId?: string | null;
  readonly reason?: 'rotation' | 'manual' | 'fallback' | 'handoff';
}
