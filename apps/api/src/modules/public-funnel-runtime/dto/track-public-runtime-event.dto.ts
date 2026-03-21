export class TrackPublicRuntimeEventDto {
  readonly eventId?: string;
  readonly eventName!: string;
  readonly publicationId!: string;
  readonly stepId?: string | null;
  readonly visitorId?: string | null;
  readonly leadId?: string | null;
  readonly assignmentId?: string | null;
  readonly anonymousId?: string | null;
  readonly currentPath?: string | null;
  readonly referrer?: string | null;
  readonly ctaLabel?: string | null;
  readonly ctaHref?: string | null;
  readonly ctaAction?: string | null;
  readonly metadata?: Record<string, unknown>;
}
