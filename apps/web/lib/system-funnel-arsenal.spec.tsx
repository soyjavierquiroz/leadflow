// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunnelMarketplaceClient } from "@/components/funnel-marketplace/funnel-marketplace-client";
import type { SystemFunnelArsenalTemplate } from "@/lib/system-funnel-arsenal";

const { operationRequest } = vi.hoisted(() => ({
  operationRequest: vi.fn(),
}));

vi.mock("@/lib/team-operations", () => ({
  authenticatedOperationRequest: operationRequest,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const templates: SystemFunnelArsenalTemplate[] = [
  {
    id: "template-1",
    templateKey: "health-wellness-evaluation",
    assetSlug: "health-wellness-evaluation",
    blueprintKey: "blueprint.health_wellness.v1",
    vertical: "health_wellness",
    industry: "Wellness",
    funnelType: "lead_capture",
    funnelFormat: "multi_step",
    objective: "lead_generation",
    stepsCount: 4,
    language: "es",
    market: "LATAM",
    framework: "evaluation",
    level: "basic",
    tags: ["wellness", "evaluacion"],
    label: "Evaluación de bienestar",
    headline: "Evaluación de bienestar",
    description: "Formulario para evaluación.",
    goal: "Capturar solicitudes de evaluación.",
    recommendedFor: "Nutrición y bienestar.",
    cta: "Quiero mi evaluación",
    pathSuggestion: "/evaluacion",
    difficulty: "basic",
    status: "active",
    version: "1.2.0",
    cloneCount: 14,
    activeInstallations: 7,
    favoriteCount: 5,
    hasMasterFunnel: true,
    blocksPresetKey: "basic-lead-capture",
    sourceFunnelId: null,
    sourceFunnelInstanceId: null,
  },
  {
    id: "template-2",
    templateKey: "mlm-quick-start",
    assetSlug: "mlm-quick-start",
    blueprintKey: "blueprint.mlm.v1",
    vertical: "mlm",
    industry: "Network",
    funnelType: "qualification",
    funnelFormat: "vsl",
    objective: "qualification",
    stepsCount: 6,
    language: "es",
    market: "MX",
    framework: "vsl",
    level: "advanced",
    tags: ["mlm", "vsl"],
    label: "MLM Quick Start",
    description: "Embudo de calificación.",
    goal: "Calificar prospectos.",
    recommendedFor: "Equipos MLM.",
    cta: "Comenzar",
    pathSuggestion: "/quick-start",
    difficulty: "advanced",
    status: "draft",
    version: "0.9.0",
    cloneCount: 0,
    activeInstallations: 0,
    favoriteCount: 0,
    hasMasterFunnel: false,
  },
];

const renderClient = (container: HTMLElement) => {
  const root = createRoot(container);

  act(() => {
    root.render(
      <FunnelMarketplaceClient
        assets={templates}
        mode="admin"
        title="Funnel Marketplace"
        description="Explora Master Funnels."
      />,
    );
  });

  return root;
};

describe("system funnel marketplace admin", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    operationRequest.mockReset();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    vi.restoreAllMocks();
    container.remove();
  });

  it("renders marketplace cards with admin actions and without ids", () => {
    root = renderClient(container);

    expect(container.textContent).toContain("Funnel Marketplace");
    expect(container.textContent).toContain("Evaluación de bienestar");
    expect(container.textContent).toContain("Published");
    expect(container.textContent).toContain("Draft");
    expect(container.textContent).toContain("Preview");
    expect(container.textContent).toContain("Versiones");
    expect(container.textContent).toContain("Master asociado");
    expect(container.textContent).toContain("Sin Master");
    expect(container.textContent).not.toContain("sourceFunnelInstanceId");
    expect(container.textContent).not.toContain("template-1");
  });

  it("creates a Master Funnel from a marketplace asset without showing ids", async () => {
    operationRequest.mockResolvedValueOnce({
      sourceFunnelInstanceId: "source-instance-2",
      sourceFunnelId: "source-funnel-2",
      builderUrl: "/admin/tenants/arsenal-team/funnels/source-funnel-2/builder",
      workspaceId: "arsenal-workspace",
      teamId: "arsenal-team",
    });
    root = renderClient(container);

    const button = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent?.includes("Crear Master Funnel"),
    );

    expect(button).toBeTruthy();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(operationRequest).toHaveBeenCalledWith(
      "/system/funnel-marketplace/mlm-quick-start/master-funnel",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    expect(container.textContent).toContain("Master Funnel creado.");
    expect(container.textContent).toContain("Master asociado");
    expect(container.textContent).toContain("Editar Master");
    expect(container.textContent).not.toContain("source-instance-2");
  });

  it("filters by blueprint and framework", () => {
    root = renderClient(container);
    const selects = Array.from(container.querySelectorAll("select"));
    const blueprintSelect = selects[1]!;
    const frameworkSelect = selects[6]!;

    act(() => {
      blueprintSelect.value = "blueprint.mlm.v1";
      blueprintSelect.dispatchEvent(new Event("change", { bubbles: true }));
      frameworkSelect.value = "vsl";
      frameworkSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("MLM Quick Start");
    expect(container.textContent).not.toContain("Evaluación de bienestar");
  });
});
