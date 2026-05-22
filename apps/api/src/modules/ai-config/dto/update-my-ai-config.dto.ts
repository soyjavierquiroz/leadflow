type PersonalAiPolicyPatch = Record<string, unknown> & {
  readonly kloser?: never;
  readonly kloser_config?: never;
};

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
  readonly aiPolicy?: PersonalAiPolicyPatch | null;
}
