"use client";

import Link from "next/link";
import {
  FunnelButtonContent,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
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
