import {
  blockHasAction,
  hasLeadCaptureConfig,
  parseBlocksArray,
} from "../block-utils";
import type { FunnelLintInput, FunnelLintIssue } from "../types";

export const CTA_MODAL_WIRING = "CTA_MODAL_WIRING";
export const OPEN_LEAD_CAPTURE_MODAL = "open_lead_capture_modal";

export const lintCtaModalWiring = (
  input: FunnelLintInput,
): FunnelLintIssue[] => {
  const blocks = parseBlocksArray(input.blocksJson);
  const hasCaptureAction = blocks.some((block) =>
    blockHasAction(block, OPEN_LEAD_CAPTURE_MODAL),
  );

  if (!hasCaptureAction || hasLeadCaptureConfig(blocks)) {
    return [];
  }

  const firstOrphanIndex = blocks.findIndex((block) =>
    blockHasAction(block, OPEN_LEAD_CAPTURE_MODAL),
  );
  const firstOrphanBlock = blocks[firstOrphanIndex];

  return [
    {
      code: CTA_MODAL_WIRING,
      severity: "error",
      message:
        "Hay CTAs que abren el modal de captura, pero no existe lead_capture_config.",
      blockKey: firstOrphanBlock?.key,
      blockIndex: firstOrphanIndex >= 0 ? firstOrphanIndex : undefined,
      autofixAvailable: true,
    },
  ];
};
