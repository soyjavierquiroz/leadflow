"use client";

import { useEffect, useRef, useState } from "react";
import {
  cx,
  FunnelEyebrow,
  PublicSectionSurface,
  RichHeadline,
} from "@/components/public-funnel/adapters/public-funnel-primitives";

type ExpireAction = "hide" | "show_message" | "redirect";

type UrgencyTimerBlockProps = {
  isBoxed?: boolean;
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  expiresAt?: string | null;
  durationMinutes?: number | null;
  expireAction?: ExpireAction | string | null;
  expireMessage?: string | null;
  expireRedirectUrl?: string | null;
  variant?: "default" | "flat";
};

type CountdownState = {
  isExpired: boolean;
  hours: string;
  minutes: string;
  seconds: string;
};

const DEFAULT_EXPIRED_MESSAGE = "Esta ventana ya expiro.";

const resolveExpireAction = (
  expireAction?: string | null,
  expireRedirectUrl?: string | null,
): ExpireAction => {
  if (expireAction === "show_message") {
    return "show_message";
  }

  if (expireAction === "redirect") {
    return expireRedirectUrl ? "redirect" : "hide";
  }

  return "hide";
};

const resolveTargetTimestamp = (
  expiresAt?: string | null,
  durationMinutes?: number | null,
): number | null => {
  if (expiresAt) {
    const parsed = new Date(expiresAt).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (durationMinutes && durationMinutes > 0) {
    return Date.now() + durationMinutes * 60 * 1000;
  }

  return null;
};

const toCountdownState = (targetTimestamp: number | null): CountdownState => {
  if (!targetTimestamp) {
    return {
      isExpired: false,
      hours: "00",
      minutes: "00",
      seconds: "00",
    };
  }

  const diff = Math.max(0, targetTimestamp - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const totalHours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    isExpired: diff <= 0,
    hours: String(totalHours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
};

export function UrgencyTimerBlock({
  isBoxed = false,
  eyebrow,
  headline,
  subheadline,
  expiresAt,
  durationMinutes,
  expireAction,
  expireMessage,
  expireRedirectUrl,
  variant = "default",
}: UrgencyTimerBlockProps) {
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    toCountdownState(resolveTargetTimestamp(expiresAt, durationMinutes)),
  );
  const hasRedirectedRef = useRef(false);
  const resolvedExpireAction = resolveExpireAction(
    expireAction,
    expireRedirectUrl,
  );

  useEffect(() => {
    const targetTimestamp = resolveTargetTimestamp(expiresAt, durationMinutes);
    setCountdown(toCountdownState(targetTimestamp));

    if (!targetTimestamp) {
      return;
    }

    const interval = window.setInterval(() => {
      const nextCountdown = toCountdownState(targetTimestamp);
      setCountdown(nextCountdown);

      if (nextCountdown.isExpired) {
        window.clearInterval(interval);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [durationMinutes, expiresAt]);

  useEffect(() => {
    if (
      !countdown.isExpired ||
      resolvedExpireAction !== "redirect" ||
      !expireRedirectUrl ||
      hasRedirectedRef.current
    ) {
      return;
    }

    hasRedirectedRef.current = true;
    window.location.href = expireRedirectUrl;
  }, [countdown.isExpired, expireRedirectUrl, resolvedExpireAction]);

  if (countdown.isExpired && resolvedExpireAction !== "show_message") {
    return null;
  }

  const timerValue = `${countdown.hours}:${countdown.minutes}:${countdown.seconds}`;
  const showExpiredMessage = countdown.isExpired && resolvedExpireAction === "show_message";

  return (
    <PublicSectionSurface
      isBoxed={isBoxed}
      surfaceSlot="urgency"
      variant={variant}
      className={cx(
        variant === "flat" ? "px-5 py-6 md:px-8 md:py-8" : "px-6 py-8 md:px-10 md:py-12",
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <FunnelEyebrow className="!justify-center" contentClassName="text-center">
          {eyebrow || "Ventana de decision"}
        </FunnelEyebrow>
        <h2 className="mt-4 text-3xl font-black leading-[0.96] tracking-[-0.05em] [color:var(--theme-section-urgency-headline-color)] md:text-5xl">
          <RichHeadline text={headline} className="font-black" />
        </h2>
        {subheadline ? (
          <p className="mt-4 max-w-2xl text-base leading-7 [color:var(--theme-section-urgency-supporting-text-color)] md:text-lg">
            <RichHeadline
              text={subheadline}
              className="font-subheadline"
              fontClassName="font-subheadline"
            />
          </p>
        ) : null}
        {showExpiredMessage ? (
          <p className="mt-8 text-4xl font-black leading-tight [color:var(--theme-action-urgency)] md:text-6xl">
            {expireMessage || DEFAULT_EXPIRED_MESSAGE}
          </p>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-3" aria-live="polite">
            <p className="font-mono text-5xl font-black leading-none tracking-[-0.08em] [color:var(--theme-section-urgency-headline-color)] md:text-7xl">
              {timerValue}
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] [color:var(--theme-section-urgency-supporting-text-color)]">
              Horas : Minutos : Segundos
            </p>
          </div>
        )}
      </div>
    </PublicSectionSurface>
  );
}
