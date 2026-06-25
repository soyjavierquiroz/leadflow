import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IndividualOnboardingForm } from "@/components/onboarding/individual-onboarding-form";
import {
  INDIVIDUAL_ONBOARDING_CONFLICT_MESSAGE,
  buildIndividualOnboardingPayload,
  getIndividualOnboardingSubmitLabel,
  submitIndividualOnboarding,
} from "@/lib/individual-onboarding";

const createFormData = (entries: Record<string, string>) => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }

  return formData;
};

describe("individual onboarding UI", () => {
  it("renders the main onboarding copy", () => {
    const action = vi.fn(async () => ({ errorMessage: null }));
    const html = renderToStaticMarkup(
      <IndividualOnboardingForm action={action} />,
    );

    expect(html).toContain("Crea tu espacio de ventas");
    expect(html).toContain("Organiza tus prospectos de WhatsApp");
    expect(html).toContain("Empieza solo y luego invita a tu equipo");
    expect(html).toContain("Nombre del negocio");
    expect(html).toContain("Tipo de negocio");
    expect(html).toContain("Selecciona el tipo de negocio");
    expect(html).toContain("Nutrición y bienestar");
    expect(html).toContain('value="nutrition_wellness"');
  });

  it("requires a non-empty business name", () => {
    const formData = createFormData({
      businessName: "   ",
      niche: "beauty",
    });

    expect(buildIndividualOnboardingPayload(formData)).toBeNull();
  });

  it("posts the expected endpoint and payload", async () => {
    const response = Response.json({
      redirectTo: "/member/crm",
      workspaceId: "workspace-1",
      teamId: "team-1",
      sponsorId: "sponsor-1",
      userId: "user-1",
      accountType: "individual",
      teamType: "personal",
    });
    const apiFetch = vi.fn(async () => response);

    const result = await submitIndividualOnboarding(
      createFormData({
        businessName: "  Ana Studio  ",
        niche: "beauty",
        country: "México",
        phone: " +5215555555555 ",
      }),
      apiFetch,
    );

    expect(apiFetch).toHaveBeenCalledWith("/onboarding/individual", {
      body: JSON.stringify({
        businessName: "Ana Studio",
        niche: "beauty",
        country: "México",
        phone: "+5215555555555",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(result).toMatchObject({
      ok: true,
      redirectTo: "/member/crm",
    });
  });

  it("keeps loading state copy available for pending submission", () => {
    expect(getIndividualOnboardingSubmitLabel(false)).toBe("Crear mi espacio");
    expect(getIndividualOnboardingSubmitLabel(true)).toBe("Creando espacio...");
  });

  it("shows a clear error for existing commercial accounts", async () => {
    const apiFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: "USER_ALREADY_HAS_TEAM_TENANT" }), {
          status: 409,
        }),
    );

    const result = await submitIndividualOnboarding(
      createFormData({
        businessName: "Ana Studio",
      }),
      apiFetch,
    );

    expect(result).toEqual({
      errorMessage: INDIVIDUAL_ONBOARDING_CONFLICT_MESSAGE,
      ok: false,
      status: 409,
    });
  });

  it("renders visible form errors", () => {
    const action = vi.fn(async () => ({ errorMessage: null }));
    const html = renderToStaticMarkup(
      <IndividualOnboardingForm
        action={action}
        initialFormState={{
          errorMessage: INDIVIDUAL_ONBOARDING_CONFLICT_MESSAGE,
        }}
      />,
    );

    expect(html).toContain(INDIVIDUAL_ONBOARDING_CONFLICT_MESSAGE);
  });

  it("falls back to member CRM when the API omits redirectTo", async () => {
    const apiFetch = vi.fn(
      async () =>
        Response.json({
          workspaceId: "workspace-1",
          teamId: "team-1",
          sponsorId: "sponsor-1",
          userId: "user-1",
          accountType: "individual",
          teamType: "personal",
        }),
    );

    const result = await submitIndividualOnboarding(
      createFormData({
        businessName: "Ana Studio",
      }),
      apiFetch,
    );

    expect(result).toMatchObject({
      ok: true,
      redirectTo: "/member/crm",
    });
  });
});
