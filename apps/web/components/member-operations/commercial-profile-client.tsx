"use client";

import {
  businessModels,
  commercialVerticals,
  getIndustriesForVertical,
  individualNiches,
  legacyNicheToCommercialTaxonomy,
} from "@leadflow/account-model";
import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/app-shell/section-header";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import {
  memberOperationRequest,
  type MemberOperationRequestError,
} from "@/lib/member-operations";
import type {
  CommercialProfile,
  CommercialProfileSalesMotion,
  CommercialProfileSnapshot,
} from "@/lib/commercial-profile";

type CommercialProfileClientProps = {
  initialSnapshot: CommercialProfileSnapshot;
  fallbackBusinessName: string;
};

type CommercialProfileFormState = {
  businessName: string;
  mainProduct: string;
  averagePrice: string;
  salesMotion: CommercialProfileSalesMotion;
  country: string;
  phone: string;
  niche: string;
  vertical: string;
  industry: string;
  businessModel: string;
};

const salesMotionOptions: Array<{
  value: CommercialProfileSalesMotion;
  label: string;
}> = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "whatsapp_calls", label: "WhatsApp + llamadas" },
  { value: "in_person", label: "Presencial" },
  { value: "mixed", label: "Mixto" },
];

const buildFormState = (
  profile: CommercialProfile | null,
  fallbackBusinessName: string,
): CommercialProfileFormState => ({
  businessName: profile?.businessName ?? fallbackBusinessName,
  mainProduct: profile?.mainProduct ?? "",
  averagePrice: profile?.averagePrice ?? "",
  salesMotion:
    salesMotionOptions.find((option) => option.value === profile?.salesMotion)
      ?.value ?? "whatsapp",
  country: profile?.country ?? "",
  phone: profile?.phone ?? "",
  niche: profile?.legacyNiche ?? "other",
  vertical: profile?.vertical ?? "other",
  industry: profile?.industry ?? "other",
  businessModel: profile?.businessModel ?? "other",
});

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "No pudimos guardar tu perfil comercial.";

const fieldLabelClassName =
  "flex flex-col gap-2 text-sm font-medium text-app-text";
const fieldControlClassName =
  "rounded-lg border border-app-border bg-app-card px-3 py-2 text-base text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft [&>option]:bg-app-card [&>option]:text-app-text";

export function CommercialProfileClient({
  initialSnapshot,
  fallbackBusinessName,
}: CommercialProfileClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [formState, setFormState] = useState(() =>
    buildFormState(initialSnapshot.profile, fallbackBusinessName),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const industryOptions = useMemo(
    () => getIndustriesForVertical(formState.vertical),
    [formState.vertical],
  );
  const needsBusinessType =
    !snapshot.profile ||
    formState.vertical === "other" ||
    formState.industry === "other" ||
    formState.businessModel === "other";

  const updateField = <Key extends keyof CommercialProfileFormState>(
    key: Key,
    value: CommercialProfileFormState[Key],
  ) => {
    if (key === "niche") {
      const taxonomy = legacyNicheToCommercialTaxonomy(String(value));

      setFormState((current) => ({
        ...current,
        niche: String(value),
        vertical: taxonomy.vertical,
        industry: taxonomy.industry,
        businessModel: taxonomy.businessModel,
      }));
      return;
    }

    setFormState((current) => {
      if (key !== "vertical") {
        return {
          ...current,
          [key]: value,
        };
      }

      const nextIndustries = getIndustriesForVertical(String(value));

      return {
        ...current,
        vertical: String(value),
        industry:
          nextIndustries.find((industry) => industry.key === current.industry)
            ?.key ??
          nextIndustries[0]?.key ??
          "other",
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const updatedSnapshot =
        await memberOperationRequest<CommercialProfileSnapshot>(
          "/commercial-profile/me",
          {
            method: "PUT",
            body: JSON.stringify({
              businessName: formState.businessName,
              mainProduct: formState.mainProduct || null,
              averagePrice: formState.averagePrice || null,
              salesMotion: formState.salesMotion,
              country: formState.country || null,
              phone: formState.phone || null,
              niche: formState.niche,
              vertical: formState.vertical,
              industry: formState.industry,
              businessModel: formState.businessModel,
            }),
          },
        );

      setSnapshot(updatedSnapshot);
      setFormState(
        buildFormState(updatedSnapshot.profile, fallbackBusinessName),
      );
      setFeedback({
        tone: "success",
        message: "Perfil comercial actualizado.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(error as MemberOperationRequestError),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Cuenta individual"
        title="Configura tu negocio"
        description="Esto ayuda a LeadFlow a preparar tus embudos, CRM e IA en futuras etapas."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      {snapshot.isComplete ? null : (
        <OperationBanner
          tone="warning"
          message="Completa nombre, vertical, industria y modelo de negocio para dejar listo tu blueprint comercial."
        />
      )}

      {needsBusinessType ? (
        <OperationBanner
          tone="warning"
          message="Completa tu tipo de negocio para recomendarte embudos adecuados."
        />
      ) : null}

      <form
        className="grid gap-6 rounded-lg border border-app-border bg-app-surface p-6 shadow-sm xl:grid-cols-2"
        onSubmit={handleSubmit}
      >
        <label className={fieldLabelClassName}>
          Nombre del negocio
          <input
            className={fieldControlClassName}
            required
            value={formState.businessName}
            onChange={(event) =>
              updateField("businessName", event.target.value)
            }
          />
        </label>

        <label className={fieldLabelClassName}>
          Tipo de negocio
          <select
            className={fieldControlClassName}
            value={formState.niche}
            onChange={(event) => updateField("niche", event.target.value)}
          >
            {individualNiches.map((niche) => (
              <option key={niche.key} value={niche.key}>
                {niche.label}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldLabelClassName}>
          Vertical
          <select
            className={fieldControlClassName}
            value={formState.vertical}
            onChange={(event) => updateField("vertical", event.target.value)}
          >
            {commercialVerticals.map((vertical) => (
              <option key={vertical.key} value={vertical.key}>
                {vertical.label}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldLabelClassName}>
          Industria
          <select
            className={fieldControlClassName}
            value={formState.industry}
            onChange={(event) => updateField("industry", event.target.value)}
          >
            {industryOptions.map((industry) => (
              <option key={industry.key} value={industry.key}>
                {industry.label}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldLabelClassName}>
          Modelo comercial
          <select
            className={fieldControlClassName}
            value={formState.businessModel}
            onChange={(event) =>
              updateField("businessModel", event.target.value)
            }
          >
            {businessModels.map((businessModel) => (
              <option key={businessModel.key} value={businessModel.key}>
                {businessModel.label}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldLabelClassName}>
          Producto principal
          <input
            className={fieldControlClassName}
            value={formState.mainProduct}
            onChange={(event) => updateField("mainProduct", event.target.value)}
          />
        </label>

        <label className={fieldLabelClassName}>
          Precio promedio
          <input
            className={fieldControlClassName}
            value={formState.averagePrice}
            onChange={(event) =>
              updateField("averagePrice", event.target.value)
            }
          />
        </label>

        <label className={fieldLabelClassName}>
          Cómo vendes
          <select
            className={fieldControlClassName}
            value={formState.salesMotion}
            onChange={(event) =>
              updateField(
                "salesMotion",
                event.target.value as CommercialProfileSalesMotion,
              )
            }
          >
            {salesMotionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldLabelClassName}>
          País
          <input
            className={fieldControlClassName}
            value={formState.country}
            onChange={(event) => updateField("country", event.target.value)}
          />
        </label>

        <label className={fieldLabelClassName}>
          Teléfono
          <input
            className={fieldControlClassName}
            value={formState.phone}
            onChange={(event) => updateField("phone", event.target.value)}
          />
        </label>

        <div className="flex flex-col gap-3 border-t border-app-border pt-5 xl:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-app-text-muted">
            Blueprint actual: {snapshot.profile?.blueprintKey ?? "pendiente"}
          </p>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-app-accent px-4 py-2.5 text-sm font-semibold text-app-accent-contrast transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
