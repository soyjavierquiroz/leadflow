// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemTenantsClient } from "@/components/system/system-tenants-client";
import {
  createSystemIndividualAccountSchema,
  type CreateSystemIndividualAccountFormValues,
} from "@/lib/system-tenant-form.schema";
import { createSystemIndividualAccount } from "@/lib/system-individual-accounts";

const { operationRequest, routerRefresh } = vi.hoisted(() => ({
  operationRequest: vi.fn(),
  routerRefresh: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefresh,
  }),
}));

vi.mock("@/lib/team-operations", () => ({
  authenticatedOperationRequest: operationRequest,
}));

const basePayload: CreateSystemIndividualAccountFormValues = {
  name: "Ana Owner",
  email: "ana@example.com",
  phone: "+59170000000",
  businessName: "Ana Studio",
  niche: "Belleza",
  country: "México",
  temporaryPassword: "TempPass123",
  sendInviteEmail: false,
};

const getButtonByText = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent === text,
  );

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

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const openIndividualModal = (container: HTMLElement) => {
  const button = getButtonByText(container, "Crear cuenta individual");

  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const fillRequiredIndividualFields = (container: HTMLElement) => {
  act(() => {
    setInputValue(getInputByLabel(container, "Nombre del propietario"), "Ana Owner");
    setInputValue(getInputByLabel(container, "Email"), "ana@example.com");
    setInputValue(getInputByLabel(container, "Nombre del negocio"), "Ana Studio");
  });
};

const submitIndividualForm = async (container: HTMLElement) => {
  const form = container.querySelector("form");

  if (!form) {
    throw new Error("Individual account form not found.");
  }

  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
};

describe("system individual account creation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    routerRefresh.mockReset();
    operationRequest.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the Super Admin action and modal copy", () => {
    act(() => {
      root.render(<SystemTenantsClient initialRows={[]} />);
    });

    const button = getButtonByText(container, "Crear cuenta individual");

    expect(button).toBeTruthy();

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Crear cuenta individual");
    expect(container.textContent).toContain(
      "Para vendedores independientes que empiezan solos y luego pueden crecer a equipo.",
    );
    expect(container.textContent).toContain("Nombre del propietario");
    expect(container.textContent).toContain("Nombre del negocio");
  });

  it("shows login URL and temporary password after a successful submit", async () => {
    operationRequest.mockResolvedValueOnce({
      userId: "user-1",
      workspaceId: "workspace-1",
      teamId: "team-1",
      sponsorId: "sponsor-1",
      email: "ana@example.com",
      temporaryPassword: "TempPass123",
      loginUrl: "/login",
      recommendedRedirect: "/member/crm",
      accountType: "individual",
      teamType: "personal",
    });

    act(() => {
      root.render(<SystemTenantsClient initialRows={[]} />);
    });

    openIndividualModal(container);
    fillRequiredIndividualFields(container);
    await submitIndividualForm(container);

    expect(operationRequest).toHaveBeenCalledWith(
      "/system/tenants/individual",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(container.textContent).toContain("ana@example.com");
    expect(container.textContent).toContain("/login");
    expect(container.textContent).toContain("TempPass123");
    expect(container.textContent).toContain(
      "Cópiala ahora. No se volverá a mostrar.",
    );
  });

  it("shows duplicate email errors returned by the endpoint", async () => {
    operationRequest.mockRejectedValueOnce(
      new Error("A user with this email already exists."),
    );

    act(() => {
      root.render(<SystemTenantsClient initialRows={[]} />);
    });

    openIndividualModal(container);
    fillRequiredIndividualFields(container);
    await submitIndividualForm(container);

    expect(container.textContent).toContain(
      "A user with this email already exists.",
    );
  });

  it("normalizes payload values before submit", () => {
    const parsed = createSystemIndividualAccountSchema.safeParse({
      ...basePayload,
      email: " ANA@EXAMPLE.COM ",
      phone: "  ",
      niche: " Nutrición ",
      country: " Bolivia ",
      temporaryPassword: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      email: "ana@example.com",
      phone: undefined,
      niche: "Nutrición",
      country: "Bolivia",
      temporaryPassword: undefined,
    });
  });

  it("posts to the system individual account endpoint", async () => {
    const request = vi.fn().mockResolvedValue({
      userId: "user-1",
      workspaceId: "workspace-1",
      teamId: "team-1",
      sponsorId: "sponsor-1",
      email: "ana@example.com",
      temporaryPassword: "TempPass123",
      loginUrl: "/login",
      recommendedRedirect: "/member/crm",
      accountType: "individual",
      teamType: "personal",
    });

    const result = await createSystemIndividualAccount(basePayload, request);

    expect(request).toHaveBeenCalledWith("/system/tenants/individual", {
      method: "POST",
      body: JSON.stringify(basePayload),
    });
    expect(result.loginUrl).toBe("/login");
  });

  it("surfaces duplicate email errors from the endpoint client", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new Error("A user with this email already exists."));

    await expect(
      createSystemIndividualAccount(basePayload, request),
    ).rejects.toThrow("A user with this email already exists.");
  });
});
