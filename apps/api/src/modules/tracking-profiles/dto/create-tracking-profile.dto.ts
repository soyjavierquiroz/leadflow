import type {
  DeduplicationMode,
  JsonValue,
  TrackingProvider,
} from '../../shared/domain.types';

export class CreateTrackingProfileDto {
  readonly workspaceId!: string;
  readonly teamId!: string;
  readonly name!: string;
  readonly provider!: TrackingProvider;
  readonly configJson!: JsonValue;
  readonly deduplicationMode?: DeduplicationMode;
}
