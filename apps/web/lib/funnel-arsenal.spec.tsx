// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunnelArsenalClient } from "@/components/member-operations/funnel-arsenal-client";
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
  templates: [
    {
      templateKey: "beauty-aesthetics-diagnosis-booking",
      blueprintKey: "blueprint.beauty_aesthetics.v1",
      label: "Reserva diagnóstico de belleza",
      description: "Página para solicitar diagnóstico.",
      goal: "Generar reservas o solicitudes de diagnóstico de belleza.",
      recommendedFor: "Salones, spas y clínicas estéticas.",
      cta: "Reservar diagnóstico",
      pathSuggestion: "/diagnostico-belleza",
      difficulty: "basic",
      blocksPresetKey: "basic-lead-capture",
      enabled: false,
    },
  ],
};

const renderClient = (container: HTMLElement, snapshot = initialSnapshot) => {
  const root = createRoot(container);

  act(() => {
    root.render(<FunnelArsenalClient initialSnapshot={snapshot} />);
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

describe("funnel arsenal page", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    operationRequest.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it("renders suggested templates", () => {
    root = renderClient(container);

    expect(container.textContent).toContain("Arsenal de embudos");
    expect(container.textContent).toContain(
      "Estos embudos están preparados para tu tipo de negocio.",
    );
    expect(container.textContent).toContain("Reserva diagnóstico de belleza");
    expect(container.textContent).toContain("Habilitar");
  });

  it("enables a funnel through the endpoint", async () => {
    operationRequest.mockResolvedValueOnce({
      ...initialSnapshot.templates[0],
      enabled: true,
      publicationId: "publication-1",
      publicUrl: "https://ana.example.com/diagnostico-belleza",
    });
    root = renderClient(container);

    await clickButton(container, "Habilitar");

    expect(operationRequest).toHaveBeenCalledWith(
      "/funnel-arsenal/me/beauty-aesthetics-diagnosis-booking/enable",
      {
        method: "POST",
      },
    );
    expect(container.textContent).toContain("Embudo habilitado.");
    expect(container.textContent).toContain(
      "https://ana.example.com/diagnostico-belleza",
    );
    expect(container.textContent).toContain("Ver embudo");
  });

  it("shows the URL for an already enabled template and copies it", async () => {
    root = renderClient(container, {
      ...initialSnapshot,
      templates: [
        {
          ...initialSnapshot.templates[0],
          enabled: true,
          publicationId: "publication-1",
          publicUrl: "https://ana.example.com/diagnostico-belleza",
        },
      ],
    });

    await clickButton(container, "Copiar URL");

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://ana.example.com/diagnostico-belleza",
    );
    expect(container.textContent).toContain("URL copiada");
  });

  it("shows enable errors", async () => {
    operationRequest.mockRejectedValueOnce(
      new Error("No hay dominio activo para publicar."),
    );
    root = renderClient(container);

    await clickButton(container, "Habilitar");

    expect(container.textContent).toContain(
      "No hay dominio activo para publicar.",
    );
  });
});
