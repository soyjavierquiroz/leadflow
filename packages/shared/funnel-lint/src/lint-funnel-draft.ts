import type { FlowGraphV1 } from "./flow-graph.types";
import { lintCtaModalWiring } from "./rules/cta-modal-wiring.rule";
import { lintDirectNextStepBypass } from "./rules/direct-next-step-bypass.rule";
import { lintExternalUrlTemplates } from "./rules/external-url-template.rule";
import { lintGraphIntegrity } from "./rules/graph-integrity.rule";
import { lintMissingOutcomeBinding } from "./rules/missing-outcome-binding.rule";
import type { FunnelLintInput, FunnelLintReport } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const extractFlowGraph = (value: FunnelLintInput["conversionContract"]) => {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value.flowGraph;
  if (!isRecord(candidate) || !isRecord(candidate.nodes)) {
    return null;
  }

  return candidate as unknown as FlowGraphV1;
};

export const lintFunnelDraft = (
  input: FunnelLintInput,
): FunnelLintReport => {
  const flowGraph = extractFlowGraph(input.conversionContract);
  const issues = [
    ...lintCtaModalWiring(input),
    ...lintDirectNextStepBypass(input),
    ...(flowGraph ? lintExternalUrlTemplates(flowGraph) : []),
    ...(flowGraph ? lintGraphIntegrity(flowGraph) : []),
    ...(flowGraph ? lintMissingOutcomeBinding(input, flowGraph) : []),
  ];
  const hasErrors = issues.some((issue) => issue.severity === "error");
  const hasWarnings = issues.some((issue) => issue.severity === "warning");

  return {
    status: hasErrors ? "broken" : hasWarnings ? "warning" : "healthy",
    issues,
    appliedFixes: [],
  };
};
