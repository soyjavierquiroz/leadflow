// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  resolvePublicFunnelHandoffState,
} from "@/lib/public-funnel-assigned-sponsor";
import { readSubmissionContext, type StoredSubmissionContext } from "@/lib/public-funnel-session";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

const publicationId = "publication-success";
const submissionContextKey = `leadflow:publication:${publicationId}:submission-context`;

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
});
