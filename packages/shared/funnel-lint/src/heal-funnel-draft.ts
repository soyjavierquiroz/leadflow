import { healLeadCaptureConfig } from "./healing/lead-capture-config.healer";
import { lintFunnelDraft } from "./lint-funnel-draft";
import type { FunnelLintInput, HealedFunnelDraft } from "./types";

export const healFunnelDraft = (
  input: FunnelLintInput,
): HealedFunnelDraft => {
  const healedLeadCaptureConfig = healLeadCaptureConfig(input.blocksJson);
  const report = lintFunnelDraft({
    ...input,
    blocksJson: healedLeadCaptureConfig.blocks,
  });

  if (healedLeadCaptureConfig.applied) {
    report.appliedFixes.push("INJECTED_LEAD_CAPTURE_CONFIG");
    report.issues.push({
      code: "SELF_HEALED_LEAD_CAPTURE_CONFIG",
      severity: "warning",
      message:
        "Se inyecto lead_capture_config porque habia CTAs de captura sin modal.",
      autofixAvailable: false,
    });
    report.status = "warning";
  }

  return {
    blocksJson: healedLeadCaptureConfig.blocks,
    report,
  };
};
