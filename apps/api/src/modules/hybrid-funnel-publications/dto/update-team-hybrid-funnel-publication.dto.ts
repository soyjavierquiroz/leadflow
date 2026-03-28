import type { JsonValue } from '../../shared/domain.types';

export class UpdateTeamHybridFunnelPublicationDto {
  readonly name?: string;
  readonly domainId?: string;
  readonly pathPrefix?: string;
  readonly templateId?: string;
  readonly seoTitle?: string;
  readonly metaDescription?: string;
  readonly blocksJson?: JsonValue;
  readonly mediaMap?: JsonValue;
}
