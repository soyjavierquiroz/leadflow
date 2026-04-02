import type { LeadSourceChannel } from '../../shared/domain.types';

export class CreateFunnelDto {
  readonly workspaceId!: string;
  readonly name!: string;
  readonly description?: string | null;
  readonly code!: string;
  readonly isTemplate?: boolean;
  readonly stages?: string[];
  readonly entrySources?: LeadSourceChannel[];
  readonly defaultTeamId?: string | null;
  readonly defaultRotationPoolId?: string | null;
}
