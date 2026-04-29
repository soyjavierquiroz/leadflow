"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import {
  FunnelButtonContent,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import { useLeadCaptureModal } from "@/components/public-funnel/lead-capture-context";
import {
  emitPublicRuntimeEvent,
  getOrCreateRuntimeSessionId,
} from "@/lib/public-runtime-tracking";
import {
  getOrCreateAnonymousId,
  readSubmissionContext,
} from "@/lib/public-funnel-session";

type TrackedCtaProps = {
  publicationId: string;
  currentStepId: string;
  currentPath: string;
  href: string;
  label: string;
  subtext?: string | null;
  className: string;
  action?: string | null;
};

export function TrackedCta({
  publicationId,
  currentStepId,
  currentPath,
  href,
  label,
  subtext,
  className,
  action,
}: TrackedCtaProps) {
  const leadCaptureModal = useLeadCaptureModal();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const submissionContext = readSubmissionContext(publicationId);

    void emitPublicRuntimeEvent({
      eventName: "cta_clicked",
      publicationId,
      stepId: currentStepId,
      anonymousId:
        submissionContext?.anonymousId ?? getOrCreateAnonymousId(publicationId),
      visitorId: submissionContext?.visitorId ?? null,
      leadId: submissionContext?.leadId ?? null,
      assignmentId: submissionContext?.assignment?.id ?? null,
      currentPath,
      ctaLabel: label,
      ctaHref: href,
      ctaAction: action ?? null,
      metadata: {
        sessionId: getOrCreateRuntimeSessionId(),
      },
    });

    if (action === "open_lead_capture_modal") {
      event.preventDefault();
      window.dispatchEvent(new Event("leadflow:open_modal"));

      if (!leadCaptureModal) {
        console.warn(
          "Lead capture modal context no disponible para este CTA.",
        );
        return;
      }

      leadCaptureModal.openModal();
    }
  };

  if (/^https?:\/\//.test(href) || href.startsWith("#")) {
    return (
      <a
        href={href}
        className={cx(
          className,
          subtext ? "flex-col items-center justify-center" : "",
        )}
        onClick={handleClick}
      >
        <FunnelButtonContent text={label} subtext={subtext} />
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={cx(
        className,
        subtext ? "flex-col items-center justify-center" : "",
      )}
      onClick={handleClick}
    >
      <FunnelButtonContent text={label} subtext={subtext} />
    </Link>
  );
}
