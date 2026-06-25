import { describe, expect, it } from "vitest";
import {
  buildIndividualCommercialProfile,
  commercialVerticalPresets,
  getIndividualCommercialPreset,
  normalizeIndividualNicheKey,
} from "@leadflow/account-model";

describe("individual niche presets", () => {
  it("returns the commercial vertical preset through a legacy niche", () => {
    expect(getIndividualCommercialPreset("nutrition_wellness")).toMatchObject({
      vertical: "health_wellness",
      defaultFunnelName: "Agenda tu evaluación de bienestar",
      suggestedCta: "Quiero mi evaluación",
      suggestedPipelineStages: [
        "Nuevo lead",
        "Interesado",
        "Evaluación",
        "Seguimiento",
        "Cliente",
      ],
      suggestedAiTone: "cercano, motivador, saludable",
      futureN8nWorkflowKey: "vertical_health_wellness_v1",
    });
  });

  it("normalizes legacy labels and falls back to other", () => {
    expect(normalizeIndividualNicheKey("Belleza")).toBe("beauty");
    expect(normalizeIndividualNicheKey("valor desconocido")).toBe("other");
    expect(getIndividualCommercialPreset("valor desconocido")).toMatchObject({
      vertical: "other",
      defaultFunnelName: "Solicita más información",
      suggestedCta: "Quiero más información",
    });
  });

  it("builds the v2 commercial profile contract", () => {
    expect(buildIndividualCommercialProfile("real_estate")).toEqual({
      vertical: "real_estate",
      industry: "residential",
      businessModel: "broker",
      legacyNiche: "real_estate",
      presetVersion: "v2",
      blueprintKey: "blueprint.real_estate.v1",
      blueprintVersion: "v1",
    });
  });

  it("keeps presets keyed by vertical", () => {
    expect(commercialVerticalPresets.mlm).toMatchObject({
      vertical: "mlm",
      defaultFunnelName: "Evalúa una oportunidad",
      futureN8nWorkflowKey: "vertical_mlm_v1",
      futureAiPromptKey: "mlm_advisor_v1",
    });
  });
});
