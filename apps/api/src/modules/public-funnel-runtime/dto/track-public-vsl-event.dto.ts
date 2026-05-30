export type PublicVslRevealSource = 'time_update' | 'fallback_timeout';

export class TrackPublicVslEventDto {
  readonly eventId?: string;
  readonly eventName!: string;
  readonly publicationId!: string;
  readonly stepId!: string;
  readonly visitorId?: string | null;
  readonly leadId?: string | null;
  readonly assignmentId?: string | null;
  readonly anonymousId?: string | null;
  readonly sessionId?: string | null;
  readonly trafficLayer?: string | null;
  readonly currentPath?: string | null;
  readonly referrer?: string | null;
  readonly blockId?: string | null;
  readonly blockType?: string | null;
  readonly stepKey?: string | null;
  readonly stepSlug?: string | null;
  readonly videoId?: string | null;
  readonly mediaId?: string | null;
  readonly progressPercent?: number | null;
  readonly currentTimeSeconds?: number | null;
  readonly durationSeconds?: number | null;
  readonly ctaMode?: string | null;
  readonly revealAfterSeconds?: number | null;
  readonly revealSource?: PublicVslRevealSource | null;
  readonly ctaLabel?: string | null;
  readonly ctaHref?: string | null;
  readonly ctaAction?: string | null;
  readonly metadata?: Record<string, unknown> | null;
}
