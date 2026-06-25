// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemFunnelArsenalClient } from "@/components/system/system-funnel-arsenal-client";
import type { SystemFunnelArsenalTemplate } from "@/lib/system-funnel-arsenal";

const { request } = vi.hoisted(() => ({
  request: vi.fn(),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/team-operations", () => ({
  authenticatedOperationRequest: request,
}));

const template: SystemFunnelArsenalTemplate = {
  id: "template-1",
  templateKey: "health-wellness-evaluation",
  blueprintKey: "blueprint.health_wellness.v1",
  vertical: "health_wellness",
  label: "Evaluación de bienestar",
  description: "Formulario para evaluación.",
  goal: "Capturar solicitudes de evaluación.",
  recommendedFor: "Nutrición y bienestar.",
  cta: "Quiero mi evaluación",
  pathSuggestion: "/evaluacion",
  difficulty: "basic",
  status: "active",
  blocksPresetKey: "basic-lead-capture",
  sourceFunnelId: null,
  sourceFunnelInstanceId: null,
};

const setValue = (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  setter?.call(element, value);
  element.dispatchEvent(
    new Event(element instanceof HTMLSelectElement ? "change" : "input", {
      bubbles: true,
    }),
  );
};

const submitForm = async (container: HTMLElement) => {
  const form = container.querySelector("form");

  if (!form) {
    throw new Error("Form not found");
  }

  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
};

const clickButton = async (container: HTMLElement, text: string) => {
  const button = Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(text),
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
};

describe("system funnel arsenal admin", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    request.mockReset();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it("creates a funnel arsenal template", async () => {
    request.mockResolvedValueOnce({
      ...template,
      templateKey: "health-check",
      label: "Chequeo de salud",
    });
    root = createRoot(container);

    act(() => {
      root.render(<SystemFunnelArsenalClient initialTemplates={[]} />);
    });

    const inputs = container.querySelectorAll("input");
    const textareas = container.querySelectorAll("textarea");
    act(() => {
      setValue(inputs[0]!, "health-check");
      setValue(inputs[1]!, "Chequeo de salud");
      setValue(textareas[0]!, "Formulario manual.");
      setValue(inputs[2]!, "Capturar interesados");
      setValue(inputs[3]!, "Nutrición");
      setValue(inputs[4]!, "Quiero el chequeo");
      setValue(inputs[5]!, "/chequeo");
    });

    await submitForm(container);

    expect(request).toHaveBeenCalledWith("/system/funnel-arsenal", {
      method: "POST",
      body: expect.stringContaining('"templateKey":"health-check"'),
    });
    expect(container.textContent).toContain("Template del Arsenal creado.");
    expect(container.textContent).toContain("Chequeo de salud");
  });

  it("edits an existing funnel arsenal template", async () => {
    request.mockResolvedValueOnce({
      ...template,
      label: "Evaluación editada",
    });
    root = createRoot(container);

    act(() => {
      root.render(<SystemFunnelArsenalClient initialTemplates={[template]} />);
    });

    await clickButton(container, "Editar");
    const nameInput = Array.from(container.querySelectorAll("input")).find(
      (input) => input.value === "Evaluación de bienestar",
    );

    act(() => {
      setValue(nameInput!, "Evaluación editada");
    });

    await submitForm(container);

    expect(request).toHaveBeenCalledWith(
      "/system/funnel-arsenal/health-wellness-evaluation",
      {
        method: "PATCH",
        body: expect.stringContaining('"label":"Evaluación editada"'),
      },
    );
    expect(container.textContent).toContain(
      "Template del Arsenal actualizado.",
    );
  });

  it("saves and displays a source FunnelInstance ID", async () => {
    request.mockResolvedValueOnce({
      ...template,
      sourceFunnelInstanceId: "source-instance-1",
      sourceFunnelInstanceLabel: "Master bienestar (master-health)",
    });
    root = createRoot(container);

    act(() => {
      root.render(<SystemFunnelArsenalClient initialTemplates={[template]} />);
    });

    await clickButton(container, "Editar");
    const sourceInput = Array.from(container.querySelectorAll("input")).find(
      (input) => input.placeholder === "Opcional",
    );

    act(() => {
      setValue(sourceInput!, "source-instance-1");
    });

    await submitForm(container);

    expect(request).toHaveBeenCalledWith(
      "/system/funnel-arsenal/health-wellness-evaluation",
      {
        method: "PATCH",
        body: expect.stringContaining(
          '"sourceFunnelInstanceId":"source-instance-1"',
        ),
      },
    );
    expect(container.textContent).toContain("Master bienestar (master-health)");
  });
});
