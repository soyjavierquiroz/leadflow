export class CreateSystemPublicationDto {
  readonly domainId!: string;
  readonly funnelId!: string;
  readonly path?: string;
  readonly isActive?: boolean;
}
