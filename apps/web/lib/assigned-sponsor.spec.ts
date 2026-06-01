// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";
import { HandoffCta } from "@/components/public-funnel/handoff-cta";
import {
  resolvePublicFunnelHandoffState,
} from "@/lib/public-funnel-assigned-sponsor";
import { readSubmissionContext, type StoredSubmissionContext } from "@/lib/public-funnel-session";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

const publicationId = "publication-success";
const submissionContextKey = `leadflow:publication:${publicationId}:submission-context`;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const buildRuntime = (advisorName: string) =>
  ({
    handoff: {
      sponsor: {
        id: `sponsor-${advisorName.toLowerCase()}`,
        displayName: advisorName,
        email: null,
        phone: "+573001112233",
        avatarUrl: null,
      },
      whatsappPhone: "+573001112233",
      whatsappMessage: "Hola",
      whatsappUrl: null,
      messageTemplate: "Hola",
    },
    assignment: {
      id: "assignment-current",
      ownershipKey: null,
      status: "assigned",
      reason: "wheel",
      assignedAt: "2026-05-06T00:00:00.000Z",
      sponsor: {
        id: `sponsor-${advisorName.toLowerCase()}`,
        displayName: advisorName,
        email: null,
        phone: "+573001112233",
        avatarUrl: null,
      },
    },
    assignedSponsor: {
      id: `sponsor-${advisorName.toLowerCase()}`,
      displayName: advisorName,
      email: null,
      phone: "+573001112233",
      avatarUrl: null,
    },
    advisor: null,
  }) as PublicFunnelRuntimePayload;

describe("resolvePublicFunnelHandoffState", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("prioriza el sponsor asignado por captura sobre el sponsor estatico del runtime", () => {
    const capturedContext: StoredSubmissionContext = {
      publicationId,
      visitorId: "visitor-1",
      anonymousId: "anon-1",
      leadId: "lead-1",
      leadSnapshot: {
        id: "lead-1",
        fullName: "Cliente Demo",
        email: null,
        phone: null,
        companyName: null,
        status: "captured",
      },
      assignment: {
        id: "assignment-current",
        ownershipKey: null,
        status: "assigned",
        reason: "wheel",
        assignedAt: "2026-05-06T00:00:00.000Z",
        sponsor: {
          id: "sponsor-freddy",
          displayName: "Freddy",
          email: null,
          phone: "+573005551111",
          avatarUrl: null,
        },
      },
      lastAssignment: {
        id: "assignment-current",
        ownershipKey: null,
        status: "assigned",
        reason: "wheel",
        assignedAt: "2026-05-06T00:00:00.000Z",
        sponsor: {
          id: "sponsor-freddy",
          displayName: "Freddy",
          email: null,
          phone: "+573005551111",
          avatarUrl: null,
        },
      },
      nextStep: null,
      handoff: {
        mode: "thank_you_then_whatsapp",
        channel: "whatsapp",
        buttonLabel: null,
        autoRedirect: false,
        autoRedirectDelayMs: null,
        sponsor: {
          id: "sponsor-freddy",
          displayName: "Freddy",
          email: null,
          phone: "+573005551111",
          avatarUrl: null,
        },
        whatsappPhone: "+573005551111",
        whatsappMessage: "Hola Freddy",
        whatsappUrl: null,
      },
      advisor: null,
      capturedAt: "2026-05-06T00:00:00.000Z",
    };

    window.sessionStorage.setItem(
      submissionContextKey,
      JSON.stringify(capturedContext),
    );

    const resolved = resolvePublicFunnelHandoffState({
      context: readSubmissionContext(publicationId),
      runtime: buildRuntime("Javier"),
    });

    expect(resolved.advisor?.name).toBe("Freddy");
    expect(resolved.advisor?.sponsorId).toBe("sponsor-freddy");
    expect(resolved.whatsappPhone).toBe("573005551111");
  });

  it("expone la ref corta de tracking desde el ownershipKey del assignment", () => {
    const capturedContext: StoredSubmissionContext = {
      publicationId,
      visitorId: "visitor-1",
      anonymousId: "anon-1",
      leadId: "lead-1",
      leadSnapshot: {
        id: "lead-1",
        fullName: "Cliente Demo",
        email: null,
        phone: null,
        companyName: null,
        status: "captured",
      },
      assignment: {
        id: "assignment-current",
        ownershipKey: "lf_own_3af5cca1a045f54d1834defd",
        status: "assigned",
        reason: "wheel",
        assignedAt: "2026-05-06T00:00:00.000Z",
        sponsor: {
          id: "sponsor-freddy",
          displayName: "Freddy",
          email: null,
          phone: "+573005551111",
          avatarUrl: null,
        },
      },
      lastAssignment: null,
      nextStep: null,
      handoff: {
        mode: "thank_you_then_whatsapp",
        channel: "whatsapp",
        buttonLabel: null,
        autoRedirect: false,
        autoRedirectDelayMs: null,
        sponsor: null,
        whatsappPhone: "+573005551111",
        whatsappMessage: "Hola Freddy",
        whatsappUrl: null,
      },
      advisor: null,
      capturedAt: "2026-05-06T00:00:00.000Z",
    };

    const resolved = resolvePublicFunnelHandoffState({
      context: capturedContext,
      runtime: buildRuntime("Javier"),
    });

    expect(resolved.leadId).toBe("lead-1");
    expect(resolved.assignmentId).toBe("assignment-current");
    expect(resolved.ownershipKey).toBe("lf_own_3af5cca1a045f54d1834defd");
    expect(resolved.ownershipRef).toBe("3AF5CCA1");
    expect(resolved.trackingRef).toBe("3AF5CCA1");
  });

  it("renderiza whatsapp_handoff_cta con avatar del advisor y ownership.ref interpolado", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(HandoffCta, {
          advisor: {
            sponsorId: "sponsor-freddy",
            name: "Freddy Catunta",
            role: null,
            phone: "+591 70554048",
            photoUrl: "https://cdn.example.com/freddy.png",
            bio: null,
            whatsappUrl: null,
          },
          leadName: "Javier Sueldo",
          handoff: {
            leadId: "lead-1",
            assignmentId: "assignment-current",
            ownershipKey: "lf_own_3af5cca1a045f54d1834defd",
            ownershipRef: null,
            trackingRef: null,
            whatsappPhone: "+591 70554048",
            whatsappMessage: null,
            whatsappUrl: null,
          },
          headline: "Continúa ahora por WhatsApp",
          whatsappText:
            "Hola {{advisorName}}, soy {{leadName}}. Ref: {{ownership.ref}}",
          autoRedirectSeconds: 0,
        }),
      );
    });

    const avatar = container.querySelector(
      'img[alt="Foto de Freddy Catunta"]',
    ) as HTMLImageElement | null;
    const link = container.querySelector("a") as HTMLAnchorElement | null;
    const decodedHref = decodeURIComponent(link?.href ?? "");

    expect(avatar?.getAttribute("src")).toBe(
      "https://cdn.example.com/freddy.png",
    );
    expect(decodedHref).toContain(
      "Hola Freddy Catunta, soy Javier Sueldo. Ref: 3AF5CCA1",
    );
    expect(decodedHref).not.toContain("{{ownership.ref}}");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
