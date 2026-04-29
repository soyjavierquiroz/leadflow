import type { FlowGraphV1 } from "../flow-graph.types";
import {
  collectBlockOutcomes,
  parseBlocksArray,
} from "../block-utils";
import type { FunnelLintInput, FunnelLintIssue } from "../types";

export const MISSING_OUTCOME_BINDING = "MISSING_OUTCOME_BINDING";

const normalizeOutcome = (value: string) => value.trim().toLowerCase();

export const lintMissingOutcomeBinding = (
  input: FunnelLintInput,
  graph: FlowGraphV1,
): FunnelLintIssue[] => {
  const currentStepId = input.currentStep?.id?.trim();
  const currentStepSlug = input.currentStep?.slug?.trim();

  if (!currentStepId && !currentStepSlug) {
    return [];
  }

  const node =
    (currentStepId ? graph.nodes[currentStepId] : null) ??
    Object.values(graph.nodes).find((candidate) => candidate.slug === currentStepSlug);
  if (!node) {
    return [];
  }

  const expectedOutcomes = Object.keys(node.exits ?? {})
    .map(normalizeOutcome)
    .filter(Boolean);

  if (expectedOutcomes.length === 0) {
    return [];
  }

  const blockOutcomes = new Set(
    parseBlocksArray(input.blocksJson).flatMap(collectBlockOutcomes),
  );

  return expectedOutcomes
    .filter((outcome) => !blockOutcomes.has(outcome))
    .map((outcome) => ({
      code: MISSING_OUTCOME_BINDING,
      severity: "warning",
      message: `El FlowGraph espera el outcome "${outcome}", pero ningun bloque de este paso lo dispara explicitamente.`,
      stepId: node.stepId,
      autofixAvailable: false,
    }));
};
