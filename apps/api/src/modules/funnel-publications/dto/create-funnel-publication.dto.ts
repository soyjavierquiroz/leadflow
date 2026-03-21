export class CreateFunnelPublicationDto {
  readonly workspaceId!: string;
  readonly teamId!: string;
  readonly domainId!: string;
  readonly funnelInstanceId!: string;
  readonly trackingProfileId?: string | null;
  readonly handoffStrategyId?: string | null;
  readonly pathPrefix!: string;
  readonly isPrimary?: boolean;
}
