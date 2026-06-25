import { describe, expect, it } from "vitest";
import {
  buildIndividualCommercialProfile,
  getIndividualCommercialPreset,
  normalizeIndividualNicheKey,
} from "@leadflow/account-model";

describe("individual niche presets", () => {
  it("returns the commercial preset for a standard niche", () => {
    expect(getIndividualCommercialPreset("nutrition_wellness")).toMatchObject({
      niche: "nutrition_wellness",
      defaultFunnelName: "Evaluación gratuita de bienestar",
      suggestedCta: "Quiero mi evaluación",
      suggestedPipelineStages: [
        "Nuevo lead",
        "Interesado",
        "Evaluación",
        "Seguimiento",
        "Cliente",
      ],
      suggestedAiTone: "cercano, motivador, saludable",
    });
  });

  it("normalizes legacy labels and falls back to other", () => {
    expect(normalizeIndividualNicheKey("Belleza")).toBe("beauty");
    expect(normalizeIndividualNicheKey("valor desconocido")).toBe("other");
    expect(getIndividualCommercialPreset("valor desconocido")).toMatchObject({
      niche: "other",
      defaultFunnelName: "Solicita más información",
      suggestedCta: "Quiero más información",
    });
  });

  it("builds the v1 commercial profile contract", () => {
    expect(buildIndividualCommercialProfile("real_estate")).toEqual({
      niche: "real_estate",
      presetVersion: "v1",
    });
  });
});
