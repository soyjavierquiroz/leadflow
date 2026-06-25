// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommercialProfileClient } from "@/components/member-operations/commercial-profile-client";
import type { CommercialProfileSnapshot } from "@/lib/commercial-profile";

const { operationRequest } = vi.hoisted(() => ({
  operationRequest: vi.fn(),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/member-operations", () => ({
  memberOperationRequest: operationRequest,
}));

const initialSnapshot: CommercialProfileSnapshot = {
  isComplete: true,
  profile: {
    id: "profile-1",
    workspaceId: "workspace-1",
    teamId: "team-1",
    sponsorId: "sponsor-1",
    vertical: "beauty_aesthetics",
    industry: "salon",
    businessModel: "service_provider",
    legacyNiche: "beauty",
    presetVersion: "v2",
    blueprintKey: "blueprint.beauty_aesthetics.v1",
    blueprintVersion: "v1",
    businessName: "Ana Studio",
    mainProduct: "Tratamiento facial",
    averagePrice: "120",
    salesMotion: "whatsapp",
    country: "México",
    phone: "+5215555555555",
    createdAt: "2026-06-25T00:00:00.000Z",
    updatedAt: "2026-06-25T00:00:00.000Z",
  },
};

const getInputByLabel = (container: HTMLElement, text: string) => {
  const label = Array.from(container.querySelectorAll("label")).find(
    (element) => element.textContent?.includes(text),
  );
  const input = label?.querySelector("input");

  if (!input) {
    throw new Error(`Input not found for label ${text}`);
  }

  return input;
};

const getSelectByLabel = (container: HTMLElement, text: string) => {
  const label = Array.from(container.querySelectorAll("label")).find(
    (element) => element.textContent?.includes(text),
  );
  const select = label?.querySelector("select");

  if (!select) {
    throw new Error(`Select not found for label ${text}`);
  }

  return select;
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const setSelectValue = (select: HTMLSelectElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;

  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const submitForm = async (container: HTMLElement) => {
  const form = container.querySelector("form");

  if (!form) {
    throw new Error("Commercial profile form not found.");
  }

  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
};

describe("commercial profile page", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    operationRequest.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders and loads the current profile", () => {
    act(() => {
      root.render(
        <CommercialProfileClient
          fallbackBusinessName="Ana Studio"
          initialSnapshot={initialSnapshot}
        />,
      );
    });

    expect(container.textContent).toContain("Configura tu negocio");
    expect(container.textContent).toContain(
      "Esto ayuda a LeadFlow a preparar tus embudos, CRM e IA en futuras etapas.",
    );
    expect(getInputByLabel(container, "Nombre del negocio").value).toBe(
      "Ana Studio",
    );
    expect(getInputByLabel(container, "Producto principal").value).toBe(
      "Tratamiento facial",
    );
    expect(container.textContent).toContain("blueprint.beauty_aesthetics.v1");
  });

  it("saves profile changes", async () => {
    operationRequest.mockResolvedValueOnce({
      ...initialSnapshot,
      profile: {
        ...initialSnapshot.profile!,
        businessName: "Ana Beauty Lab",
        mainProduct: "Skincare premium",
      },
    });

    act(() => {
      root.render(
        <CommercialProfileClient
          fallbackBusinessName="Ana Studio"
          initialSnapshot={initialSnapshot}
        />,
      );
    });

    act(() => {
      setInputValue(
        getInputByLabel(container, "Nombre del negocio"),
        "Ana Beauty Lab",
      );
      setInputValue(
        getInputByLabel(container, "Producto principal"),
        "Skincare premium",
      );
    });

    await submitForm(container);

    expect(operationRequest).toHaveBeenCalledWith(
      "/commercial-profile/me",
      expect.objectContaining({
        method: "PUT",
      }),
    );
    expect(JSON.parse(operationRequest.mock.calls[0][1].body)).toMatchObject({
      businessName: "Ana Beauty Lab",
      mainProduct: "Skincare premium",
      vertical: "beauty_aesthetics",
      businessModel: "service_provider",
    });
    expect(container.textContent).toContain("Perfil comercial actualizado.");
  });

  it("maps nutrition and wellness to health wellness taxonomy before saving", async () => {
    operationRequest.mockResolvedValueOnce({
      isComplete: true,
      profile: {
        ...initialSnapshot.profile!,
        vertical: "health_wellness",
        industry: "nutrition",
        businessModel: "advisor",
        legacyNiche: "nutrition_wellness",
        blueprintKey: "blueprint.health_wellness.v1",
      },
    });

    act(() => {
      root.render(
        <CommercialProfileClient
          fallbackBusinessName="Margarita Wellness"
          initialSnapshot={{ profile: null, isComplete: false }}
        />,
      );
    });

    act(() => {
      setSelectValue(
        getSelectByLabel(container, "Tipo de negocio"),
        "nutrition_wellness",
      );
    });

    expect(getSelectByLabel(container, "Vertical").value).toBe(
      "health_wellness",
    );
    expect(getSelectByLabel(container, "Industria").value).toBe("nutrition");
    expect(getSelectByLabel(container, "Modelo comercial").value).toBe(
      "advisor",
    );

    await submitForm(container);

    expect(JSON.parse(operationRequest.mock.calls[0][1].body)).toMatchObject({
      niche: "nutrition_wellness",
      vertical: "health_wellness",
      industry: "nutrition",
      businessModel: "advisor",
    });
  });

  it("shows save errors", async () => {
    operationRequest.mockRejectedValueOnce(
      new Error("No se pudo actualizar el perfil comercial."),
    );

    act(() => {
      root.render(
        <CommercialProfileClient
          fallbackBusinessName="Ana Studio"
          initialSnapshot={initialSnapshot}
        />,
      );
    });

    await submitForm(container);

    expect(container.textContent).toContain(
      "No se pudo actualizar el perfil comercial.",
    );
  });

  it("shows an incomplete-profile CTA state", () => {
    act(() => {
      root.render(
        <CommercialProfileClient
          fallbackBusinessName="Ana Studio"
          initialSnapshot={{ profile: null, isComplete: false }}
        />,
      );
    });

    expect(container.textContent).toContain(
      "Completa nombre, vertical, industria y modelo de negocio",
    );
    expect(container.textContent).toContain(
      "Completa tu tipo de negocio para recomendarte embudos adecuados.",
    );
    expect(getSelectByLabel(container, "Tipo de negocio").value).toBe("other");
  });

  it("keeps commercial profile controls on app surfaces", () => {
    act(() => {
      root.render(
        <CommercialProfileClient
          fallbackBusinessName="Ana Studio"
          initialSnapshot={initialSnapshot}
        />,
      );
    });

    const classNames = Array.from(container.querySelectorAll("*"))
      .map((element) => element.getAttribute("class") ?? "")
      .join(" ");

    expect(classNames).not.toContain("bg-white");
    expect(classNames).toContain("bg-app-card");
  });
});
