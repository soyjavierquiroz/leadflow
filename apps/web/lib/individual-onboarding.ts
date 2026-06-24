export type IndividualOnboardingPayload = {
  businessName: string;
  niche?: string;
  country?: string;
  phone?: string;
};

export type IndividualOnboardingResponse = {
  redirectTo?: string;
  workspaceId: string;
  teamId: string;
  sponsorId: string;
  userId: string;
  accountType: "individual";
  teamType: "personal";
};

export type IndividualOnboardingResult =
  | {
      ok: true;
      redirectTo: string;
      payload: IndividualOnboardingResponse;
    }
  | {
      ok: false;
      errorMessage: string;
      status?: number;
    };

export type IndividualOnboardingFormState = {
  errorMessage: string | null;
};

type IndividualOnboardingFetch = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;

export const INDIVIDUAL_ONBOARDING_CONFLICT_MESSAGE =
  "Tu usuario ya pertenece a una cuenta existente. Ingresa desde tu panel actual.";

const DEFAULT_INDIVIDUAL_ONBOARDING_REDIRECT = "/member/crm";

export const getIndividualOnboardingSubmitLabel = (isPending: boolean) =>
  isPending ? "Creando espacio..." : "Crear mi espacio";

const readFormString = (formData: FormData, fieldName: string) => {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
};

const addOptionalField = (
  payload: IndividualOnboardingPayload,
  fieldName: keyof Omit<IndividualOnboardingPayload, "businessName">,
  value: string,
) => {
  if (value) {
    payload[fieldName] = value;
  }
};

export const buildIndividualOnboardingPayload = (
  formData: FormData,
): IndividualOnboardingPayload | null => {
  const businessName = readFormString(formData, "businessName");

  if (!businessName) {
    return null;
  }

  const payload: IndividualOnboardingPayload = {
    businessName,
  };

  addOptionalField(payload, "niche", readFormString(formData, "niche"));
  addOptionalField(payload, "country", readFormString(formData, "country"));
  addOptionalField(payload, "phone", readFormString(formData, "phone"));

  return payload;
};

export const submitIndividualOnboarding = async (
  formData: FormData,
  apiFetch: IndividualOnboardingFetch,
): Promise<IndividualOnboardingResult> => {
  const payload = buildIndividualOnboardingPayload(formData);

  if (!payload) {
    return {
      errorMessage: "Ingresa el nombre de tu negocio para continuar.",
      ok: false,
    };
  }

  let response: Response;

  try {
    response = await apiFetch("/onboarding/individual", {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch {
    return {
      errorMessage:
        "No pudimos crear tu espacio de ventas. Intenta nuevamente en unos minutos.",
      ok: false,
    };
  }

  if (response.status === 401) {
    return {
      errorMessage: "Tu sesión expiró. Ingresa nuevamente para continuar.",
      ok: false,
      status: response.status,
    };
  }

  if (response.status === 409) {
    return {
      errorMessage: INDIVIDUAL_ONBOARDING_CONFLICT_MESSAGE,
      ok: false,
      status: response.status,
    };
  }

  if (!response.ok) {
    return {
      errorMessage:
        "No pudimos crear tu espacio de ventas. Intenta nuevamente en unos minutos.",
      ok: false,
      status: response.status,
    };
  }

  const responsePayload =
    (await response.json()) as IndividualOnboardingResponse;

  return {
    ok: true,
    payload: responsePayload,
    redirectTo:
      typeof responsePayload.redirectTo === "string" &&
      responsePayload.redirectTo.trim()
        ? responsePayload.redirectTo
        : DEFAULT_INDIVIDUAL_ONBOARDING_REDIRECT,
  };
};
