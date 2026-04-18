import { z } from "zod";

const optionalNullableStringField = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}, z.string().optional().nullable());

const requiredSelection = (message: string) =>
  z.string().trim().min(1, message);

const publicationTrackingFieldShape = {
  metaPixelId: optionalNullableStringField,
  tiktokPixelId: optionalNullableStringField,
  metaCapiToken: optionalNullableStringField,
  tiktokAccessToken: optionalNullableStringField,
};

export const systemPublicationFormSchema = z.object({
  teamId: requiredSelection("Selecciona un tenant para continuar."),
  domainId: requiredSelection("Selecciona un dominio válido antes de guardar."),
  funnelId: requiredSelection("Selecciona un funnel válido antes de guardar."),
  path: requiredSelection("Ingresa un path válido para el binding."),
  isActive: z.boolean(),
  ...publicationTrackingFieldShape,
});

export const teamPublicationFormSchema = z.object({
  domainId: requiredSelection("Selecciona un dominio para la publicación."),
  funnelInstanceId: requiredSelection(
    "Selecciona un funnel para la publicación.",
  ),
  pathPrefix: requiredSelection("Ingresa un path para la publicación."),
  trackingProfileId: optionalNullableStringField,
  handoffStrategyId: optionalNullableStringField,
  ...publicationTrackingFieldShape,
  isPrimary: z.boolean(),
});

export const getFirstZodError = (error: z.ZodError) =>
  error.issues[0]?.message ?? "No pudimos validar el formulario.";
