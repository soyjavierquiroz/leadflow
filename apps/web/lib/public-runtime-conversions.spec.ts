// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmationConversionTracker } from "@/components/public-funnel/confirmation-conversion-tracker";
import { emitLeadCaptureConversionEvent } from "@/lib/public-runtime-conversions";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const buildRuntime = (
  overrides?: Partial<PublicFunnelRuntimePayload>,
): PublicFunnelRuntimePayload =>
  ({
    entryContext: {
      trafficLayer: "PAID_ADS",
      browserPixelsEnabled: true,
    },
    publication: {
      id: "publication-1",
      metaPixelId: "meta-pixel-1",
      tiktokPixelId: "tiktok-pixel-1",
    },
    funnel: {
      id: "funnel-1",
      name: "Demo Funnel",
      code: "demo-funnel",
      structuralType: "lead_capture",
    },
    currentStep: {
      id: "step-1",
      slug: "captura",
      path: "/promo",
      stepType: "landing",
    },
    ...overrides,
  }) as PublicFunnelRuntimePayload;

const renderTracker = (runtime: PublicFunnelRuntimePayload) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(ConfirmationConversionTracker, { runtime }));
  });

  return { container, root };
};

const cleanupRoot = ({ container, root }: { container: HTMLElement; root: Root }) => {
  act(() => {
    root.unmount();
  });
  container.remove();
};

describe("emitLeadCaptureConversionEvent", () => {
  afterEach(() => {
    delete window.fbq;
    delete window.ttq;
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("sends Meta and TikTok browser conversion events with the same submission event id", () => {
    const fbq = vi.fn();
    const ttqTrack = vi.fn();
    window.fbq = fbq;
    window.ttq = {
      track: ttqTrack,
    };

    emitLeadCaptureConversionEvent({
      runtime: buildRuntime(),
      payload: {
        publicationId: "publication-1",
        currentStepId: "step-1",
        anonymousId: "anon-1",
        sourceChannel: "form",
        submissionEventId: "form-submit-1",
      },
      response: {
        httpStatus: 200,
        lead: {
          id: "lead-1",
        },
        assignment: null,
        nextStep: null,
      } as never,
      block: {
        type: "lead_capture_form",
      },
    });

    expect(fbq).toHaveBeenCalledWith(
      "track",
      "CompleteRegistration",
      expect.objectContaining({
        publication_id: "publication-1",
        lead_id: "lead-1",
      }),
      {
        eventID: "form-submit-1",
      },
    );
    expect(ttqTrack).toHaveBeenCalledWith(
      "CompleteRegistration",
      expect.objectContaining({
        publication_id: "publication-1",
        lead_id: "lead-1",
        event_id: "form-submit-1",
      }),
    );
  });

  it("fires CompleteRegistration from the confirmation tracker with the event id query param", () => {
    const fbq = vi.fn();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    window.fbq = fbq;
    window.history.pushState({}, "", "/promo/publication-1/confirmacion?event_id=evt-confirm-1");

    const mounted = renderTracker(
      buildRuntime({
        publication: {
          id: "publication-1",
          metaPixelId: "meta-pixel-1",
          tiktokPixelId: null,
        } as never,
        currentStep: {
          id: "step-confirmation",
          stepType: "confirmation",
        } as never,
      }),
    );

    expect(fbq).toHaveBeenCalledWith(
      "track",
      "CompleteRegistration",
      {},
      {
        eventID: "evt-confirm-1",
      },
    );
    expect(infoSpy).toHaveBeenCalledWith("CompleteRegistration fired", {
      publicationId: "publication-1",
      eventId: "evt-conf...rm-1",
    });

    cleanupRoot(mounted);
  });

  it("does not fire twice for the same publication, event id, and conversion event", () => {
    const fbq = vi.fn();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    window.fbq = fbq;
    window.history.pushState({}, "", "/promo/publication-1/confirmacion?event_id=evt-confirm-2");
    const runtime = buildRuntime({
      publication: {
        id: "publication-1",
        metaPixelId: "meta-pixel-1",
        tiktokPixelId: null,
      } as never,
      currentStep: {
        id: "step-confirmation",
        stepType: "confirmation",
      } as never,
    });

    const firstMount = renderTracker(runtime);
    cleanupRoot(firstMount);
    const secondMount = renderTracker(runtime);

    expect(fbq).toHaveBeenCalledTimes(1);

    cleanupRoot(secondMount);
  });

  it("retries until fbq is available on the confirmation page", () => {
    vi.useFakeTimers();
    const fbq = vi.fn();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    window.history.pushState({}, "", "/promo/publication-1/confirmacion?event_id=evt-confirm-3");

    const mounted = renderTracker(
      buildRuntime({
        publication: {
          id: "publication-1",
          metaPixelId: "meta-pixel-1",
          tiktokPixelId: null,
        } as never,
        currentStep: {
          id: "step-confirmation",
          stepType: "confirmation",
        } as never,
      }),
    );

    expect(fbq).not.toHaveBeenCalled();
    window.fbq = fbq;

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(fbq).toHaveBeenCalledWith(
      "track",
      "CompleteRegistration",
      {},
      {
        eventID: "evt-confirm-3",
      },
    );

    cleanupRoot(mounted);
  });
});
