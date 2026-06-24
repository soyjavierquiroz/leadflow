import { describe, expect, it } from "vitest";
import {
  buildPublicFunnelMetadata,
  resolvePublicFunnelSeo,
} from "@/lib/public-funnel-metadata";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

const buildRuntime = (
  overrides?: Partial<PublicFunnelRuntimePayload>,
): PublicFunnelRuntimePayload =>
  ({
    request: {
      host: "ingresos.retodetransformacion.com",
      path: "/presentacion",
      publicationPathPrefix: "/presentacion",
      relativeStepPath: "/",
    },
    domain: {
      id: "domain-1",
      host: "ingresos.retodetransformacion.com",
      normalizedHost: "ingresos.retodetransformacion.com",
      domainType: "custom",
      isPrimary: true,
      canonicalHost: null,
      redirectToPrimary: false,
    },
    team: {
      id: "team-1",
      name: "Reto de Transformacion",
      description: "Sistema de ingresos digitales para profesionales.",
    },
    entryContext: {
      entryMode: "organic_asesor",
      trafficLayer: "ORGANIC",
      forcedSponsorId: null,
      adWheelId: null,
      browserPixelsEnabled: false,
      attributionType: "organic",
      attributionSlug: null,
      runtimePathPrefix: null,
      referralQueryParam: null,
    },
    publication: {
      id: "publication-1",
      pathPrefix: "/presentacion",
      isPrimary: true,
      trackingProfileId: null,
      handoffStrategyId: null,
      metaPixelId: null,
      tiktokPixelId: null,
      seoTitle: "Reto de Transformacion",
      seoDescription: "Aprende a construir una oferta digital rentable.",
      ogImageUrl: "https://cdn.kuruk.in/leadflow-assets/funnels/reto-og.jpg",
      faviconUrl: null,
      nextStepPath: null,
      manifestVersion: 1,
      runtimeHealthStatus: "healthy",
    },
    theme: "default",
    funnel: {
      id: "funnel-1",
      name: "Funnel del Reto",
      code: "reto",
      status: "active",
      structuralType: "lead_capture",
      conversionContract: {},
      settingsJson: {},
      mediaMap: {},
      template: {
        id: "template-1",
        code: "template",
        name: "Template",
        version: 1,
        funnelType: "lead_capture",
        blocksJson: {},
        mediaMap: {},
        settingsJson: {},
        allowedOverridesJson: {},
      },
    },
    trackingProfile: null,
    handoffStrategy: null,
    currentStep: {
      id: "step-1",
      slug: "captura",
      path: "/presentacion",
      stepType: "landing",
      position: 1,
      isEntryStep: true,
      isConversionStep: false,
      blocksJson: [],
      mediaMap: {},
      settingsJson: {},
    },
    nextStep: null,
    previousStep: null,
    steps: [],
    ...overrides,
  }) as PublicFunnelRuntimePayload;

describe("public funnel metadata", () => {
  it("uses publication SEO fields and keeps og:image absolute", () => {
    const seo = resolvePublicFunnelSeo(buildRuntime());

    expect(seo.title).toBe("Reto de Transformacion");
    expect(seo.description).toBe(
      "Aprende a construir una oferta digital rentable.",
    );
    expect(seo.canonicalUrl).toBe(
      "https://ingresos.retodetransformacion.com/presentacion",
    );
    expect(seo.ogImage.url).toBe(
      "https://cdn.kuruk.in/leadflow-assets/funnels/reto-og.jpg",
    );
    expect(seo.ogImage.width).toBe(1200);
    expect(seo.ogImage.height).toBe(630);
    expect(seo.ogImage.type).toBe("image/jpeg");
  });

  it("converts relative og images to the publication canonical host", () => {
    const seo = resolvePublicFunnelSeo(
      buildRuntime({
        publication: {
          ...buildRuntime().publication,
          ogImageUrl: "/assets/reto-og.webp",
        },
      }),
    );

    expect(seo.ogImage.url).toBe(
      "https://ingresos.retodetransformacion.com/assets/reto-og.webp",
    );
  });

  it("uses the app origin for the default og image fallback", () => {
    const seo = resolvePublicFunnelSeo(
      buildRuntime({
        publication: {
          ...buildRuntime().publication,
          ogImageUrl: null,
        },
      }),
    );

    expect(seo.ogImage.url).toMatch(/\/og\/leadflow-default$/);
    expect(seo.ogImage.url).not.toContain(
      "ingresos.retodetransformacion.com",
    );
  });

  it("filters Bolt defaults from public metadata", () => {
    const metadata = buildPublicFunnelMetadata(
      buildRuntime({
        publication: {
          ...buildRuntime().publication,
          seoTitle: "Kurukin AI Automation Landing Page",
          seoDescription: "bolt.new generated fallback",
          ogImageUrl: "https://bolt.new/generated-cover.png",
        },
        funnel: {
          ...buildRuntime().funnel,
          name: "Oferta Publica Real",
        },
      }),
    );

    expect(JSON.stringify(metadata).toLowerCase()).not.toContain("bolt");
    expect(metadata.title).toBe("Oferta Publica Real");
    expect((metadata.openGraph as { type?: string } | undefined)?.type).toBe(
      "website",
    );
  });

  it("returns image/jpeg metadata for publication JPG Open Graph images", () => {
    const metadata = buildPublicFunnelMetadata(buildRuntime());
    const openGraph = metadata.openGraph as
      | { images?: Array<{ url: string; type?: string }> }
      | undefined;

    expect(openGraph?.images?.[0]).toEqual(
      expect.objectContaining({
        url: "https://cdn.kuruk.in/leadflow-assets/funnels/reto-og.jpg",
        type: "image/jpeg",
        width: 1200,
        height: 630,
      }),
    );
  });

  it("keeps tenant SEO isolated per publication", () => {
    const publicationA = resolvePublicFunnelSeo(buildRuntime());
    const publicationB = resolvePublicFunnelSeo(
      buildRuntime({
        domain: {
          ...buildRuntime().domain,
          host: "b.example.com",
          normalizedHost: "b.example.com",
        },
        request: {
          ...buildRuntime().request,
          host: "b.example.com",
          path: "/promo/javier",
        },
        publication: {
          ...buildRuntime().publication,
          id: "publication-b",
          seoTitle: "Publicacion B",
          seoDescription: "Descripcion B",
          ogImageUrl: "https://cdn.example.com/b.webp",
        },
      }),
    );

    expect(publicationA.title).toBe("Reto de Transformacion");
    expect(publicationB.title).toBe("Publicacion B");
    expect(publicationB.canonicalUrl).toBe("https://b.example.com/promo/javier");
    expect(publicationB.ogImage.url).toBe("https://cdn.example.com/b.webp");
  });
});
