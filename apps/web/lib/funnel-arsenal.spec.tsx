// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunnelMarketplaceClient } from "@/components/funnel-marketplace/funnel-marketplace-client";
import type { FunnelArsenalSnapshot } from "@/lib/funnel-arsenal";

const { operationRequest } = vi.hoisted(() => ({
  operationRequest: vi.fn(),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/member-operations", () => ({
  memberOperationRequest: operationRequest,
}));

const initialSnapshot: FunnelArsenalSnapshot = {
  blueprintKey: "blueprint.beauty_aesthetics.v1",
  requiresCommercialProfile: false,
  templates: [
    {
      templateKey: "beauty-aesthetics-diagnosis-booking",
      assetSlug: "beauty-aesthetics-diagnosis-booking",
      blueprintKey: "blueprint.beauty_aesthetics.v1",
      vertical: "beauty_aesthetics",
      industry: "Belleza",
      funnelType: "lead_capture",
      funnelFormat: "multi_step",
      objective: "lead_generation",
      stepsCount: 3,
      language: "es",
      market: "MX",
      framework: "diagnosis_booking",
      level: "basic",
      tags: ["diagnostico", "reservas"],
      label: "Reserva diagnóstico de belleza",
      headline: "Reserva diagnóstico de belleza",
      description: "Página para solicitar diagnóstico.",
      goal: "Generar reservas o solicitudes de diagnóstico de belleza.",
      recommendedFor: "Salones, spas y clínicas estéticas.",
      cta: "Reservar diagnóstico",
      pathSuggestion: "/diagnostico-belleza",
      difficulty: "basic",
      status: "active",
      version: "1.0.0",
      cloneCount: 8,
      activeInstallations: 3,
      favoriteCount: 2,
      hasMasterFunnel: true,
      enabled: false,
    },
  ],
};

const renderClient = (container: HTMLElement, snapshot = initialSnapshot) => {
  const root = createRoot(container);

  act(() => {
    root.render(
      <FunnelMarketplaceClient
        assets={snapshot.templates}
        mode="member"
        title="Marketplace de Funnels"
        description="Elige un Funnel compatible con tu negocio."
        blueprintKey={snapshot.blueprintKey}
        requiresCommercialProfile={snapshot.requiresCommercialProfile}
      />,
    );
  });

  return root;
};

const clickButton = async (container: HTMLElement, text: string) => {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent?.includes(text),
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("member funnel marketplace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    operationRequest.mockReset();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it("renders a marketplace grid instead of the old arsenal CRUD surface", () => {
    root = renderClient(container);

    expect(container.textContent).toContain("Marketplace de Funnels");
    expect(container.textContent).toContain("Reserva diagnóstico de belleza");
    expect(container.textContent).toContain("Preview");
    expect(container.textContent).toContain("Activar Funnel");
    expect(container.textContent).toContain("Clone Count");
    expect(container.textContent).not.toContain("sourceFunnelInstanceId");
  });

  it("filters by text and keeps cards on dark design tokens", () => {
    root = renderClient(container);
    const input = container.querySelector("input");

    act(() => {
      setInputValue(input!, "wellness");
    });

    expect(container.textContent).toContain("No hay Funnels con estos filtros");

    const classNames = Array.from(container.querySelectorAll("*"))
      .map((element) => element.getAttribute("class") ?? "")
      .join(" ");

    expect(classNames).toContain("bg-app-surface");
    expect(classNames).toContain("bg-app-card");
    expect(classNames).not.toContain("bg-white");
  });

  it("activates a funnel through the existing enable endpoint", async () => {
    operationRequest.mockResolvedValueOnce({
      ...initialSnapshot.templates[0],
      enabled: true,
      source: "master_clone",
      publicUrl: "https://ana.example.com/diagnostico-belleza",
    });
    root = renderClient(container);

    await clickButton(container, "Activar Funnel");

    expect(operationRequest).toHaveBeenCalledWith(
      "/funnel-arsenal/me/beauty-aesthetics-diagnosis-booking/enable",
      { method: "POST" },
    );
    expect(container.textContent).toContain("Funnel activado.");
  });

  it("shows the commercial profile required state", () => {
    root = renderClient(container, {
      blueprintKey: null,
      requiresCommercialProfile: true,
      templates: [],
    });

    expect(container.textContent).toContain("Completa tu perfil comercial");
    expect(container.textContent).toContain("Funnels compatibles");
  });

  it("hides marketplace funnels without a Master Funnel for members", () => {
    root = renderClient(container, {
      ...initialSnapshot,
      templates: [
        {
          ...initialSnapshot.templates[0],
          hasMasterFunnel: false,
        },
      ],
    });

    expect(container.textContent).not.toContain("Reserva diagnóstico de belleza");
    expect(container.textContent).toContain("No hay Funnels con estos filtros");
  });
});
