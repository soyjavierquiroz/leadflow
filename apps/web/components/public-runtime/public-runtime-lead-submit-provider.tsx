"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  clearEntryContext,
  persistEntryContext,
  persistSubmissionContext,
  submitRuntimeLeadCapture,
  type LeadCaptureSubmissionPayload,
  type LeadCaptureSubmissionResponse,
} from "@/lib/public-funnel-session";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import { emitLeadCaptureConversionEvent } from "@/lib/public-runtime-conversions";
import { resolveRuntimeNextStepPath } from "@/lib/funnel-runtime-routing";

export type RuntimeLeadSubmitBlockContext = {
  type: string;
  outcome?: string | null;
  successRedirect?: string | null;
  successMode?: "next_step" | "inline_message" | null;
  handoffEnabled?: boolean | null;
  handoffDuration?: number | null;
  handoffTitle?: string | null;
  handoffSubtitle?: string | null;
  loaderType?: "pulse" | "spinner" | "progress" | null;
};

type RuntimeLeadSubmitOptions = {
  block?: RuntimeLeadSubmitBlockContext | null;
  redirectOnSuccess?: boolean;
};

type PublicRuntimeLeadSubmitContextValue = {
  submitLeadCapture: (
    payload: LeadCaptureSubmissionPayload,
    options?: RuntimeLeadSubmitOptions,
  ) => Promise<LeadCaptureSubmissionResponse>;
};

const PublicRuntimeLeadSubmitContext =
  createContext<PublicRuntimeLeadSubmitContextValue | null>(null);

type HandoffTransitionConfig = {
  title: string;
  subtitle: string;
  loaderType: "pulse" | "spinner" | "progress";
};

type PublicRuntimeLeadSubmitProviderProps = {
  hostname: string;
  path: string;
  runtime: PublicFunnelRuntimePayload;
  children: ReactNode;
};

const DEFAULT_HANDOFF_TRANSITION: HandoffTransitionConfig = {
  title: "¡Registro exitoso!",
  subtitle: "Asignando tu asesor experto...",
  loaderType: "pulse",
};

const shouldRedirectAfterSuccess = (options?: RuntimeLeadSubmitOptions) => {
  if (typeof options?.redirectOnSuccess === "boolean") {
    return options.redirectOnSuccess;
  }

  const normalizedBlockType = options?.block?.type?.trim().toLowerCase();
  if (normalizedBlockType === "lead_capture_config") {
    return true;
  }

  return options?.block?.successMode !== "inline_message";
};

const resolveHandoffDuration = (options?: RuntimeLeadSubmitOptions) =>
  Math.max(0, options?.block?.handoffDuration ?? 1500);

const resolveHandoffTransitionConfig = (
  options?: RuntimeLeadSubmitOptions,
): HandoffTransitionConfig => ({
  title:
    options?.block?.handoffTitle?.trim() || DEFAULT_HANDOFF_TRANSITION.title,
  subtitle:
    options?.block?.handoffSubtitle?.trim() ||
    DEFAULT_HANDOFF_TRANSITION.subtitle,
  loaderType: options?.block?.loaderType ?? DEFAULT_HANDOFF_TRANSITION.loaderType,
});

function HandoffInterstitial({
  config,
}: {
  config: HandoffTransitionConfig;
}) {
  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-hidden bg-slate-950 text-center">
      <div className="bg-glow-conferencia absolute inset-0 opacity-20" />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-6">
        <div className="mb-8 flex h-16 items-center justify-center">
          {config.loaderType === "spinner" ? (
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 [border-top-color:var(--funnel-vsl-highlight)]" />
          ) : null}
          {config.loaderType === "pulse" ? (
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 animate-ping rounded-full [background:color-mix(in_srgb,var(--funnel-vsl-highlight)_20%,transparent)]" />
              <div className="absolute inset-2 rounded-full [background:color-mix(in_srgb,var(--funnel-vsl-highlight)_35%,transparent)]" />
              <div className="absolute inset-5 rounded-full [background:var(--funnel-vsl-highlight)]" />
            </div>
          ) : null}
          {config.loaderType === "progress" ? (
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full [background:var(--funnel-vsl-highlight)]" />
            </div>
          ) : null}
        </div>
        <h2 className="text-3xl font-black tracking-tight text-white [font-family:var(--font-header)]">
          {config.title}
        </h2>
        <p className="mt-3 text-base font-medium leading-7 [color:var(--theme-text-muted)] [font-family:var(--font-body)]">
          {config.subtitle}
        </p>
      </div>
    </div>
  );
}

export function PublicRuntimeLeadSubmitProvider({
  hostname,
  path,
  runtime,
  children,
}: PublicRuntimeLeadSubmitProviderProps) {
  const router = useRouter();
  const handoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [transitionConfig, setTransitionConfig] =
    useState<HandoffTransitionConfig | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (runtime.entryContext.attributionType === "organic") {
      clearEntryContext(runtime.publication.id);
      return;
    }

    persistEntryContext(runtime.publication.id, runtime.entryContext);
  }, [runtime.entryContext, runtime.publication.id]);

  useEffect(
    () => () => {
      if (handoffTimeoutRef.current) {
        clearTimeout(handoffTimeoutRef.current);
      }
    },
    [],
  );

  const value = useMemo<PublicRuntimeLeadSubmitContextValue>(
    () => ({
      submitLeadCapture: async (payload, options) => {
        const response = await submitRuntimeLeadCapture({
          hostname,
          path,
          payload,
        });
        if (response.success === false) {
          throw new Error("No pudimos asignarte un asesor en este momento.");
        }

        const resolvedNextStepPath =
          response.nextStep?.path?.trim() ||
          resolveRuntimeNextStepPath({
            runtime,
            outcome: options?.block?.outcome,
            successRedirect: options?.block?.successRedirect,
          });

        persistSubmissionContext(payload.publicationId, response);

        if (response.httpStatus === 200 && options?.block) {
          emitLeadCaptureConversionEvent({
            runtime,
            payload,
            response,
            block: options.block,
            nextStepPath: resolvedNextStepPath,
          });
        }

        const shouldRedirect =
          shouldRedirectAfterSuccess(options) && Boolean(resolvedNextStepPath);
        const handoffEnabled = options?.block?.handoffEnabled ?? true;

        if (shouldRedirect && resolvedNextStepPath) {
          if (handoffEnabled) {
            setTransitionConfig(resolveHandoffTransitionConfig(options));
            setIsTransitioning(true);
            await new Promise<void>((resolve) => {
              handoffTimeoutRef.current = setTimeout(() => {
                handoffTimeoutRef.current = null;
                resolve();
              }, resolveHandoffDuration(options));
            });
          }

          router.push(resolvedNextStepPath);
          setIsTransitioning(false);
          setTransitionConfig(null);
        }

        return response;
      },
    }),
    [hostname, path, router, runtime],
  );

  return (
    <PublicRuntimeLeadSubmitContext.Provider value={value}>
      {children}
      {isTransitioning && transitionConfig ? (
        <HandoffInterstitial config={transitionConfig} />
      ) : null}
    </PublicRuntimeLeadSubmitContext.Provider>
  );
}

export const usePublicRuntimeLeadSubmit = () =>
  useContext(PublicRuntimeLeadSubmitContext);
