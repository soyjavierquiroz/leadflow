import {
  blockHasAction,
  collectBlockTargets,
  normalizeBlockType,
  normalizePathTarget,
  parseBlocksArray,
} from "../block-utils";
import type { FunnelLintInput, FunnelLintIssue } from "../types";
import { OPEN_LEAD_CAPTURE_MODAL } from "./cta-modal-wiring.rule";

export const DIRECT_NEXT_STEP_BYPASS = "DIRECT_NEXT_STEP_BYPASS";

const SAFE_NEXT_STEP_ACTIONS = new Set([
  OPEN_LEAD_CAPTURE_MODAL,
  "submit_lead_capture",
  "lead_capture_submit",
  "scroll_to_capture",
  "next_step_from_contract",
]);

const isCaptureSubmitBlock = (type: string) =>
  normalizeBlockType(type) === "lead_capture_form" ||
  normalizeBlockType(type) === "lead_capture_config";

export const lintDirectNextStepBypass = (
  input: FunnelLintInput,
): FunnelLintIssue[] => {
  if (
    input.structuralType !== "two_step_conversion" &&
    input.structuralType !== "multi_step_conversion"
  ) {
    return [];
  }

  const nextStepPath = input.nextStepPath ?? input.nextStep?.path ?? null;
  if (!nextStepPath) {
    return [];
  }

  const normalizedNextStepPath = normalizePathTarget(nextStepPath);
  if (!normalizedNextStepPath) {
    return [];
  }

  const blocks = parseBlocksArray(input.blocksJson);
  const bypassIndex = blocks.findIndex((block) => {
    if (isCaptureSubmitBlock(block.type)) {
      return false;
    }

    const hasSafeAction = Array.from(SAFE_NEXT_STEP_ACTIONS).some((action) =>
      blockHasAction(block, action),
    );
    if (hasSafeAction) {
      return false;
    }

    return collectBlockTargets(block).some(
      (target) => normalizePathTarget(target) === normalizedNextStepPath,
    );
  });

  if (bypassIndex < 0) {
    return [];
  }

  const bypassBlock = blocks[bypassIndex];

  return [
    {
      code: DIRECT_NEXT_STEP_BYPASS,
      severity: "error",
      message:
        "Hay un CTA que envia al siguiente paso sin pasar por un submit de captura.",
      blockKey: bypassBlock?.key,
      blockIndex: bypassIndex,
      autofixAvailable: false,
    },
  ];
};
