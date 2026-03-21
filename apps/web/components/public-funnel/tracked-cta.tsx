"use client";

import Link from "next/link";
import {
  emitPublicRuntimeEvent,
  getOrCreateRuntimeSessionId,
} from "@/lib/public-runtime-tracking";
import { getOrCreateAnonymousId } from "@/lib/public-funnel-session";

type TrackedCtaProps = {
  publicationId: string;
  currentStepId: string;
  currentPath: string;
  href: string;
  label: string;
  className: string;
  action?: string | null;
};

export function TrackedCta({
  publicationId,
  currentStepId,
  currentPath,
  href,
  label,
  className,
  action,
}: TrackedCtaProps) {
  const handleClick = () => {
    void emitPublicRuntimeEvent({
      eventName: "cta_clicked",
      publicationId,
      stepId: currentStepId,
      anonymousId: getOrCreateAnonymousId(publicationId),
      currentPath,
      ctaLabel: label,
      ctaHref: href,
      ctaAction: action ?? null,
      metadata: {
        sessionId: getOrCreateRuntimeSessionId(),
      },
    });
  };

  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} className={className} onClick={handleClick}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {label}
    </Link>
  );
}
