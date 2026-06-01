"use client";

export const normalizeWhatsappPhone = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D+/g, "");
  if (!digits) {
    return null;
  }

  return digits.startsWith("00") ? digits.slice(2) : digits;
};

export const buildWhatsappUrl = (
  phone: string | null,
  message: string | null,
) => {
  if (!phone) {
    return null;
  }

  if (!message) {
    return `https://wa.me/${phone}`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

export const formatOwnershipRef = (ownershipKey: string | null | undefined) => {
  const normalized = ownershipKey?.trim();
  if (!normalized) {
    return null;
  }

  const withoutPrefix = normalized.startsWith("lf_own_")
    ? normalized.slice("lf_own_".length)
    : normalized;
  const shortRef = withoutPrefix.slice(0, 8).toUpperCase();

  return shortRef || null;
};

export const extractVisibleRef = (message: string | null | undefined) =>
  message?.match(/(?:^|\n)\s*Ref:\s*([A-Za-z0-9_-]+)/i)?.[1]?.trim() ??
  null;

export type PublicHandoffTemplateInput = {
  template: string;
  advisorName?: string | null;
  leadName?: string | null;
  leadId?: string | null;
  assignmentId?: string | null;
  ownershipKey?: string | null;
  ownershipRef?: string | null;
  trackingRef?: string | null;
  fallbackMessage?: string | null;
  seconds?: number | string | null;
};

export const resolvePublicHandoffTrackingRef = (
  input: Pick<
    PublicHandoffTemplateInput,
    "ownershipKey" | "ownershipRef" | "trackingRef" | "fallbackMessage"
  >,
) =>
  input.trackingRef?.trim() ||
  input.ownershipRef?.trim() ||
  formatOwnershipRef(input.ownershipKey) ||
  extractVisibleRef(input.fallbackMessage);

export const renderPublicHandoffTemplate = (
  input: PublicHandoffTemplateInput,
) => {
  const advisorName = input.advisorName?.trim() ?? "";
  const advisorFirstName = advisorName.split(/\s+/)[0] || advisorName;
  const leadName = input.leadName?.trim() || "un nuevo lead";
  const leadFirstName = leadName.split(/\s+/)[0] || leadName;
  const trackingRef = resolvePublicHandoffTrackingRef(input) ?? "";
  const replacements: Record<string, string> = {
    advisorName,
    "advisor.name": advisorName,
    "advisor.firstName": advisorFirstName,
    "advisor.first_name": advisorFirstName,
    leadName,
    "lead.name": leadName,
    "lead.firstName": leadFirstName,
    "lead.first_name": leadFirstName,
    leadId: input.leadId?.trim() ?? "",
    "lead.id": input.leadId?.trim() ?? "",
    assignmentId: input.assignmentId?.trim() ?? "",
    "assignment.id": input.assignmentId?.trim() ?? "",
    ownershipKey: input.ownershipKey?.trim() ?? "",
    "ownership.key": input.ownershipKey?.trim() ?? "",
    ownershipRef: trackingRef,
    "ownership.ref": trackingRef,
    trackingRef,
    "tracking.ref": trackingRef,
    seconds: input.seconds === null || input.seconds === undefined
      ? ""
      : String(input.seconds),
  };

  return input.template.replace(
    /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g,
    (match, key) => replacements[key] ?? match,
  );
};
