export class UpdateMyAiConfigDto {
  readonly basePrompt!: string;
  readonly routeContexts?: {
    readonly risk?: string | null;
    readonly offer?: string | null;
    readonly product?: string | null;
    readonly service?: string | null;
    readonly business?: string | null;
  };
  readonly defaultCta?: string | null;
}
