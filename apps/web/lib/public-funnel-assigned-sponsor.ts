"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import {
  readSubmissionContext,
  type StoredSubmissionContext,
  useSubmissionContext,
} from "@/lib/public-funnel-session";
import { buildWhatsappUrl, normalizeWhatsappPhone } from "@/lib/public-handoff";

export type ResolvedPublicFunnelAdvisor = {
  sponsorId: string | null;
  name: string;
  role: string | null;
  phone: string | null;
  photoUrl: string | null;
  bio: string | null;
  whatsappUrl: string | null;
};

export type ResolvedPublicFunnelHandoffState = {
  advisor: ResolvedPublicFunnelAdvisor | null;
  leadName: string | null;
  whatsappPhone: string | null;
  whatsappMessage: string | null;
  whatsappUrl: string | null;
};

const normalizeAdvisorRecord = (advisor: {
  name: string;
  role?: string | null;
  phone: string | null;
  photoUrl: string | null;
  bio: string | null;
  whatsappUrl: string | null;
}): ResolvedPublicFunnelAdvisor => ({
  sponsorId: null,
  name: advisor.name,
  role: advisor.role ?? null,
  phone: advisor.phone,
  photoUrl: advisor.photoUrl,
  bio: advisor.bio,
  whatsappUrl: advisor.whatsappUrl,
});

const normalizeSponsorRecord = (sponsor: {
  id: string;
  displayName: string;
  phone: string | null;
  avatarUrl: string | null;
}): ResolvedPublicFunnelAdvisor => ({
  sponsorId: sponsor.id,
  name: sponsor.displayName,
  role: null,
  phone: sponsor.phone,
  photoUrl: sponsor.avatarUrl,
  bio: null,
  whatsappUrl: null,
});

const getContextSponsor = (context: StoredSubmissionContext | null) =>
  context?.assignment?.sponsor ??
  context?.lastAssignment?.sponsor ??
  context?.handoff?.sponsor ??
  null;

const getRuntimeSponsor = (runtime: PublicFunnelRuntimePayload) =>
  runtime.assignment?.sponsor ??
  runtime.assignedSponsor ??
  runtime.handoff.sponsor ??
  null;

const getStoredAdvisorLabel = (context: StoredSubmissionContext | null) =>
  context?.advisor?.name ?? getContextSponsor(context)?.displayName ?? null;

const getRuntimeAdvisorLabel = (runtime: PublicFunnelRuntimePayload) =>
  runtime.advisor?.name ?? getRuntimeSponsor(runtime)?.displayName ?? null;

const hasAuthoritativeRuntimeAdvisor = (runtime: PublicFunnelRuntimePayload) =>
  Boolean(runtime.advisor ?? getRuntimeSponsor(runtime));

export const resolvePublicFunnelHandoffState = ({
  context,
  runtime,
}: {
  context: StoredSubmissionContext | null;
  runtime: PublicFunnelRuntimePayload;
}): ResolvedPublicFunnelHandoffState => {
  const runtimeSponsor = getRuntimeSponsor(runtime);
  const contextSponsor = getContextSponsor(context);
  const advisor =
    (contextSponsor
      ? normalizeSponsorRecord(contextSponsor)
      : context?.advisor
        ? normalizeAdvisorRecord(context.advisor)
        : runtimeSponsor
          ? normalizeSponsorRecord(runtimeSponsor)
          : runtime.advisor
            ? normalizeAdvisorRecord(runtime.advisor)
            : null) ?? null;

  const contextAssignmentIsAuthoritative = Boolean(contextSponsor);
  const runtimeIsAuthoritative =
    !contextAssignmentIsAuthoritative && hasAuthoritativeRuntimeAdvisor(runtime);
  const leadName = context?.leadSnapshot?.fullName?.trim() || null;
  const whatsappMessage = runtimeIsAuthoritative
    ? runtime.handoff.whatsappMessage ??
      runtime.handoff.messageTemplate ??
      context?.handoff?.whatsappMessage ??
      null
    : context?.handoff?.whatsappMessage ??
      runtime.handoff.whatsappMessage ??
      runtime.handoff.messageTemplate ??
      null;
  const whatsappPhone = runtimeIsAuthoritative
    ? normalizeWhatsappPhone(runtime.handoff.whatsappPhone) ??
      normalizeWhatsappPhone(advisor?.phone) ??
      normalizeWhatsappPhone(context?.handoff?.whatsappPhone) ??
      null
    : normalizeWhatsappPhone(context?.handoff?.whatsappPhone) ??
      normalizeWhatsappPhone(advisor?.phone) ??
      normalizeWhatsappPhone(runtime.handoff.whatsappPhone) ??
      null;
  const whatsappUrl = runtimeIsAuthoritative
    ? runtime.handoff.whatsappUrl ??
      advisor?.whatsappUrl ??
      context?.handoff?.whatsappUrl ??
      buildWhatsappUrl(whatsappPhone, whatsappMessage)
    : context?.handoff?.whatsappUrl ??
      advisor?.whatsappUrl ??
      runtime.handoff.whatsappUrl ??
      buildWhatsappUrl(whatsappPhone, whatsappMessage);

  return {
    advisor,
    leadName,
    whatsappPhone,
    whatsappMessage,
    whatsappUrl,
  };
};

export const useResolvedPublicFunnelHandoffState = (
  publicationId: string,
  runtime: PublicFunnelRuntimePayload,
): ResolvedPublicFunnelHandoffState => {
  const isClient = typeof window !== "undefined";
  const context = useSubmissionContext(publicationId, runtime);
  const [hasHydrated, setHasHydrated] = useState(false);
  const lastDiscrepancyKeyRef = useRef<string | null>(null);
  const resolvedState = useMemo(
    () => resolvePublicFunnelHandoffState({ context, runtime }),
    [context, runtime],
  );

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    const previousSessionContext = readSubmissionContext(publicationId);
    const previousAdvisor = getStoredAdvisorLabel(previousSessionContext);
    const nextAdvisor = getRuntimeAdvisorLabel(runtime);

    if (!nextAdvisor) {
      return;
    }

    if (previousAdvisor && previousAdvisor !== nextAdvisor) {
      const discrepancyKey = `${publicationId}:${previousAdvisor}:${nextAdvisor}`;
      if (lastDiscrepancyKeyRef.current !== discrepancyKey) {
        lastDiscrepancyKeyRef.current = discrepancyKey;
        console.warn(
          `[Wheels-Sync] Discrepancia detectada: de ${previousAdvisor} a ${nextAdvisor}.`,
        );
      }
    }
  }, [isClient, publicationId, runtime]);

  if (!isClient || !hasHydrated) {
    return {
      advisor: null,
      leadName: null,
      whatsappPhone: null,
      whatsappMessage: null,
      whatsappUrl: null,
    };
  }

  return resolvedState;
};
