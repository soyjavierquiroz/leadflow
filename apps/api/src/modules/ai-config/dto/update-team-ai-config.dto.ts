export class UpdateTeamAiConfigDto {
  readonly basePrompt?: string | null;
  readonly aiPolicy?: Record<string, unknown> | null;
}
