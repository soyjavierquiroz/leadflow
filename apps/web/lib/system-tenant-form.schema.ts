import { z } from "zod";

export const tenantProvisioningStatuses = [
  "active",
  "suspended",
  "pending",
] as const;

export const createSystemTenantSchema = z.object({
  tenantName: z
    .string()
    .trim()
    .min(2, "Ingresa el nombre de la agencia."),
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Ingresa un correo de administrador válido."),
});

export const editSystemTenantSchema = z.object({
  tenantName: z
    .string()
    .trim()
    .min(2, "Ingresa el nombre de la agencia."),
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Ingresa un correo de administrador válido."),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
      "Usa 1 a 63 caracteres: letras, números o guiones, sin guion al inicio o final.",
    ),
  provisioningStatus: z.enum(tenantProvisioningStatuses),
});

export type CreateSystemTenantFormValues = z.infer<
  typeof createSystemTenantSchema
>;

export type EditSystemTenantFormValues = z.infer<
  typeof editSystemTenantSchema
>;
