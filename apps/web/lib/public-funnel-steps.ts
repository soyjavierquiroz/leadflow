export function isConfirmationConversionStep(step: unknown): boolean {
  if (typeof step !== "string") {
    return false;
  }

  return ["confirmation", "thank_you", "handoff"].includes(
    step.trim().toLowerCase(),
  );
}
