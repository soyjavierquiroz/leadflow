"use client";

import { useEffect, useState } from "react";
import {
  flatBlockTitleClassName,
  PublicEyebrow,
  PublicSectionSurface,
  PublicStatCard,
} from "@/components/public-funnel/adapters/public-funnel-primitives";

type UrgencyTimerBlockProps = {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  expiresAt?: string | null;
  durationMinutes?: number | null;
  variant?: "default" | "flat";
};

type CountdownState = {
  expired: boolean;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

const toCountdownState = (targetTime: number | null): CountdownState => {
  if (!targetTime) {
    return {
      expired: false,
      days: "00",
      hours: "00",
      minutes: "00",
      seconds: "00",
    };
  }

  const diff = Math.max(0, targetTime - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    expired: diff <= 0,
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
};

export function UrgencyTimerBlock({
  eyebrow,
  headline,
  subheadline,
  expiresAt,
  durationMinutes,
  variant = "default",
}: UrgencyTimerBlockProps) {
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    toCountdownState(null),
  );

  useEffect(() => {
    let targetTimestamp: number | null = null;

    if (expiresAt) {
      const parsed = new Date(expiresAt).getTime();
      targetTimestamp = Number.isFinite(parsed) ? parsed : null;
    } else if (durationMinutes && durationMinutes > 0) {
      targetTimestamp = Date.now() + durationMinutes * 60 * 1000;
    }

    const tick = () => {
      setCountdown(toCountdownState(targetTimestamp));
    };
    const timeout = window.setTimeout(tick, 0);

    if (!targetTimestamp) {
      return () => window.clearTimeout(timeout);
    }

    const interval = window.setInterval(() => {
      setCountdown(toCountdownState(targetTimestamp));
    }, 1000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [durationMinutes, expiresAt]);

  return (
    <PublicSectionSurface
      tone="warm"
      variant={variant}
      className={variant === "flat" ? "py-6 text-left md:py-8" : ""}
    >
      <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div>
          <PublicEyebrow
            tone="warm"
            className={variant === "flat" ? "text-amber-700" : ""}
          >
            {eyebrow || "Ventana de decisión"}
          </PublicEyebrow>
          <h2
            className={
              variant === "flat"
                ? `mt-3 ${flatBlockTitleClassName}`
                : "mt-3 text-left text-3xl font-black tracking-tight text-slate-950"
            }
          >
            {headline}
          </h2>
          <p
            className={
              variant === "flat"
                ? "mt-4 max-w-2xl text-left text-base leading-7 text-slate-700"
                : "mt-4 max-w-2xl text-left text-base leading-7 text-slate-700"
            }
          >
            {subheadline ||
              "Bloque de urgencia listo para templates comerciales sin depender de lógica custom por funnel."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <PublicStatCard label="Días" value={countdown.days} tone="warm" variant={variant} />
          <PublicStatCard label="Horas" value={countdown.hours} tone="warm" variant={variant} />
          <PublicStatCard
            label="Minutos"
            value={countdown.minutes}
            tone="warm"
            variant={variant}
          />
          <PublicStatCard
            label="Segundos"
            value={countdown.seconds}
            tone="warm"
            variant={variant}
          />
        </div>
      </div>
      <div
        className={
          variant === "flat"
            ? "mt-5 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-slate-700"
            : "mt-5 rounded-[1.5rem] border border-amber-200 bg-white px-4 py-4 text-sm leading-6 text-slate-700"
        }
      >
        {countdown.expired
          ? "La cuenta regresiva llegó a cero. El bloque sigue visible para que el funnel conserve continuidad."
          : "La cuenta regresiva se actualiza en cliente y puede usarse para reforzar urgencia comercial declarativa."}
      </div>
    </PublicSectionSurface>
  );
}
