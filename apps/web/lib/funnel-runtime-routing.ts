import type { JsonValue, PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

type JsonRecord = Record<string, JsonValue | undefined>;

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asRecord = (value: unknown) => (isRecord(value) ? value : null);

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const normalizeOptionalPath = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const resolveStepPathById = (
  runtime: PublicFunnelRuntimePayload,
  stepId: string,
) => runtime.steps.find((step) => step.id === stepId)?.path ?? null;

export const resolveFlowGraphContractPath = (
  runtime: PublicFunnelRuntimePayload,
  outcome = "default",
) => {
  const contract = asRecord(runtime.funnel.conversionContract);
  const graph = asRecord(contract?.flowGraph);
  const nodes = asRecord(graph?.nodes);
  const currentNode =
    asRecord(nodes?.[runtime.currentStep.id]) ??
    Object.values(nodes ?? {}).reduce<JsonRecord | null>((matchedNode, candidate) => {
      if (matchedNode) {
        return matchedNode;
      }

      const node = asRecord(candidate);
      return node?.slug === runtime.currentStep.slug ? node : null;
    }, null);
  const exits = asRecord(asRecord(currentNode)?.exits);
  const normalizedOutcome = outcome.trim().toLowerCase() || "default";
  const exit =
    asRecord(exits?.[normalizedOutcome]) ??
    (normalizedOutcome === "default" ? null : asRecord(exits?.default));
  const toStepId = asString(exit?.toStepId);

  return toStepId ? resolveStepPathById(runtime, toStepId) : null;
};

const resolveContractTransitionRecord = (runtime: PublicFunnelRuntimePayload) => {
  const contract = asRecord(runtime.funnel.conversionContract);
  if (!contract) {
    return null;
  }

  const transitions = asRecord(contract.transitions);
  if (!transitions) {
    return null;
  }

  const bySlug = asRecord(transitions[runtime.currentStep.slug]);
  if (bySlug) {
    return bySlug;
  }

  const byStepType = asRecord(transitions[runtime.currentStep.stepType]);
  if (byStepType) {
    return byStepType;
  }

  return asRecord(transitions.default);
};

const resolveLegacyContractTransitionPath = (
  runtime: PublicFunnelRuntimePayload,
) => {
  const transition = resolveContractTransitionRecord(runtime);
  if (!transition) {
    return null;
  }

  const explicitPath =
    asString(transition.path) ||
    asString(transition.nextStepPath) ||
    asString(transition.default);
  if (explicitPath) {
    return explicitPath;
  }

  const explicitStepSlug = asString(transition.stepSlug);
  if (explicitStepSlug) {
    const mappedStep = runtime.steps.find(
      (step) => step.slug === explicitStepSlug,
    );
    if (mappedStep?.path) {
      return mappedStep.path;
    }
  }

  const explicitStepType = asString(transition.stepType);
  if (explicitStepType) {
    const mappedStep = runtime.steps.find(
      (step) => step.stepType === explicitStepType,
    );
    if (mappedStep?.path) {
      return mappedStep.path;
    }
  }

  return null;
};

type ResolveRuntimeNextStepPathOptions = {
  runtime: PublicFunnelRuntimePayload;
  outcome?: string | null;
  successRedirect?: string | null;
  warnOnJsonFallback?: boolean;
};

export const resolveRuntimeNextStepPath = ({
  runtime,
  outcome = "default",
  successRedirect,
  warnOnJsonFallback = true,
}: ResolveRuntimeNextStepPathOptions) => {
  const flowGraphPath = resolveFlowGraphContractPath(runtime, outcome ?? undefined);
  if (flowGraphPath) {
    return flowGraphPath;
  }

  const legacyContractPath = resolveLegacyContractTransitionPath(runtime);
  if (legacyContractPath) {
    return legacyContractPath;
  }

  const runtimeNextStepPath =
    normalizeOptionalPath(runtime.nextStep?.path) ??
    normalizeOptionalPath(runtime.publication.nextStepPath);
  if (runtimeNextStepPath) {
    return runtimeNextStepPath;
  }

  const jsonFallbackPath = normalizeOptionalPath(successRedirect);
  if (jsonFallbackPath) {
    if (warnOnJsonFallback && process.env.NODE_ENV !== "production") {
      console.warn(
        "[runtime-routing] Flow graph inconsistency detected; using success_redirect fallback.",
        {
          currentStepId: runtime.currentStep.id,
          currentStepSlug: runtime.currentStep.slug,
          currentStepPath: runtime.currentStep.path,
          outcome,
          successRedirect: jsonFallbackPath,
        },
      );
    }

    return jsonFallbackPath;
  }

  return null;
};
