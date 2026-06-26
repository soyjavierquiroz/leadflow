import { describe, expect, it } from "vitest";
import {
  getCustomDomainPathSuggestion,
  isPlatformPublicationHost,
} from "./publication-path-suggestions";

describe("publication path suggestions", () => {
  it("calculates the custom-domain path from a shared platform path", () => {
    expect(
      getCustomDomainPathSuggestion({
        selectedDomainHost: "bienestar.retodetransformacion.com",
        currentPathPrefix: "/u/pasos-al-exito-2e00b9f4/evaluacion",
      }),
    ).toBe("/evaluacion");
  });

  it("uses root when the shared path only contains the team slug", () => {
    expect(
      getCustomDomainPathSuggestion({
        selectedDomainHost: "bienestar.retodetransformacion.com",
        currentPathPrefix: "/u/pasos-al-exito-2e00b9f4",
      }),
    ).toBe("/");
  });

  it("does not suggest changes for platform hosts or non-shared paths", () => {
    expect(isPlatformPublicationHost("https://leadflow.kuruk.in")).toBe(true);
    expect(
      getCustomDomainPathSuggestion({
        selectedDomainHost: "leadflow.kuruk.in",
        currentPathPrefix: "/u/pasos-al-exito-2e00b9f4/evaluacion",
      }),
    ).toBeNull();
    expect(
      getCustomDomainPathSuggestion({
        selectedDomainHost: "bienestar.retodetransformacion.com",
        currentPathPrefix: "/evaluacion",
      }),
    ).toBeNull();
  });
});
