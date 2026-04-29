import type { FlowGraphV1 } from "../flow-graph.types";
import type { FunnelLintIssue } from "../types";

export const NO_ENTRY_POINT = "NO_ENTRY_POINT";
export const BROKEN_EDGE = "BROKEN_EDGE";
export const DEAD_END = "DEAD_END";
export const ORPHAN_STEP = "ORPHAN_STEP";

export const lintGraphIntegrity = (
  graph: FlowGraphV1,
): FunnelLintIssue[] => {
  const issues: FunnelLintIssue[] = [];
  const nodeIds = new Set(Object.keys(graph.nodes));
  const entryStepId = graph.entryStepId?.trim() || null;

  if (!entryStepId || !nodeIds.has(entryStepId)) {
    issues.push({
      code: NO_ENTRY_POINT,
      severity: "error",
      message:
        "El FlowGraph no define un entryStepId valido o el entry no existe en nodes.",
      stepId: entryStepId ?? undefined,
      autofixAvailable: false,
    });
  }

  for (const node of Object.values(graph.nodes)) {
    const exits = Object.values(node.exits ?? {});

    for (const exit of exits) {
      const targetStepId = exit.toStepId?.trim() || "";
      if (!targetStepId || !nodeIds.has(targetStepId)) {
        issues.push({
          code: BROKEN_EDGE,
          severity: "error",
          message: `La salida "${exit.outcome}" apunta a un stepId inexistente.`,
          stepId: node.stepId,
          targetStepId: targetStepId || undefined,
          autofixAvailable: false,
        });
      }
    }

    if (!node.isTerminal && exits.length === 0) {
      issues.push({
        code: DEAD_END,
        severity: "error",
        message:
          "El nodo no es terminal pero no tiene salidas definidas.",
        stepId: node.stepId,
        autofixAvailable: false,
      });
    }
  }

  if (!entryStepId || !nodeIds.has(entryStepId)) {
    return issues;
  }

  const visited = new Set<string>();
  const queue: string[] = [entryStepId];

  while (queue.length > 0) {
    const currentStepId = queue.shift();
    if (!currentStepId || visited.has(currentStepId)) {
      continue;
    }

    visited.add(currentStepId);
    const currentNode = graph.nodes[currentStepId];
    if (!currentNode) {
      continue;
    }

    for (const exit of Object.values(currentNode.exits ?? {})) {
      const targetStepId = exit.toStepId?.trim() || "";
      if (targetStepId && nodeIds.has(targetStepId) && !visited.has(targetStepId)) {
        queue.push(targetStepId);
      }
    }
  }

  for (const node of Object.values(graph.nodes)) {
    if (!visited.has(node.stepId)) {
      issues.push({
        code: ORPHAN_STEP,
        severity: "error",
        message:
          "El nodo existe en el FlowGraph pero no es alcanzable desde el entry point.",
        stepId: node.stepId,
        autofixAvailable: false,
      });
    }
  }

  return issues;
};
