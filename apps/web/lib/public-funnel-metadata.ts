import type { Metadata } from "next";
import { webPublicConfig } from "@/lib/public-env";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

type SeoImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
  type?: string;
};

export type PublicFunnelSeo = {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage: SeoImage;
  favicon?: string;
};

const fallbackAppName = "LeadFlow";
const fallbackDescription =
  "Embudo publico de LeadFlow para captacion, presentacion y seguimiento comercial.";
const fallbackOgImagePath = "/og/leadflow-default";
const blockedSeoTitle = "kurukin ai automation landing page";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeHost = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.+$/, "");

export const isBlockedPublicSeoValue = (value: string) => {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === blockedSeoTitle ||
    normalized.includes("bolt.new") ||
    normalized.includes("bolt.new/")
  );
};

export const cleanPublicSeoText = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed || isBlockedPublicSeoValue(trimmed)) {
    return undefined;
  }

  return trimmed;
};

const getFallbackOrigin = () => {
  try {
    return new URL(webPublicConfig.urls.site).origin;
  } catch {
    return "https://leadflow.kuruk.in";
  }
};

const resolveCanonicalOrigin = (host: string) => {
  const normalizedHost = normalizeHost(host);

  if (!normalizedHost) {
    return getFallbackOrigin();
  }

  return `https://${normalizedHost}`;
};

const resolveAbsoluteUrl = (
  value: unknown,
  origin: string,
  options?: { allowFallbackPath?: boolean },
) => {
  const trimmed = cleanPublicSeoText(value);

  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed, origin);

    if (!["http:", "https:"].includes(url.protocol)) {
      return undefined;
    }

    if (
      !options?.allowFallbackPath &&
      isBlockedPublicSeoValue(url.hostname)
    ) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
};

const resolveImageContentType = (url: string) => {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
      return "image/jpeg";
    }

    if (pathname.endsWith(".png")) {
      return "image/png";
    }

    if (pathname.endsWith(".webp")) {
      return "image/webp";
    }
  } catch {
    return undefined;
  }

  return undefined;
};

export const buildPublicFunnelCanonicalUrl = (
  runtime: PublicFunnelRuntimePayload,
) => {
  const origin = resolveCanonicalOrigin(runtime.domain.host || runtime.request.host);
  const canonicalPath = runtime.request.path === "/" ? "" : runtime.request.path;

  return new URL(canonicalPath || "/", origin).toString();
};

export const resolvePublicFunnelSeo = (
  runtime: PublicFunnelRuntimePayload,
): PublicFunnelSeo => {
  const publication = runtime.publication;
  const stepSettings = asRecord(runtime.currentStep.settingsJson);
  const funnelSettings = asRecord(runtime.funnel.settingsJson);
  const stepSeo = asRecord(stepSettings?.seo);
  const funnelSeo = asRecord(funnelSettings?.seo);
  const canonicalUrl = buildPublicFunnelCanonicalUrl(runtime);
  const canonicalOrigin = new URL(canonicalUrl).origin;
  const title =
    cleanPublicSeoText(publication.seoTitle) ||
    cleanPublicSeoText(stepSeo?.title) ||
    cleanPublicSeoText(stepSettings?.title) ||
    cleanPublicSeoText(funnelSeo?.title) ||
    cleanPublicSeoText(funnelSettings?.title) ||
    cleanPublicSeoText(runtime.funnel.name) ||
    fallbackAppName;
  const description =
    cleanPublicSeoText(publication.seoDescription) ||
    cleanPublicSeoText(stepSeo?.metaDescription) ||
    cleanPublicSeoText(stepSeo?.description) ||
    cleanPublicSeoText(stepSettings?.metaDescription) ||
    cleanPublicSeoText(stepSettings?.summary) ||
    cleanPublicSeoText(stepSettings?.description) ||
    cleanPublicSeoText(funnelSeo?.metaDescription) ||
    cleanPublicSeoText(funnelSeo?.description) ||
    cleanPublicSeoText(funnelSettings?.metaDescription) ||
    cleanPublicSeoText(funnelSettings?.summary) ||
    cleanPublicSeoText(funnelSettings?.description) ||
    cleanPublicSeoText(runtime.team.description) ||
    fallbackDescription;
  const ogImageUrl =
    resolveAbsoluteUrl(publication.ogImageUrl, canonicalOrigin) ||
    resolveAbsoluteUrl(stepSeo?.ogImageUrl, canonicalOrigin) ||
    resolveAbsoluteUrl(stepSeo?.ogImage, canonicalOrigin) ||
    resolveAbsoluteUrl(stepSeo?.image, canonicalOrigin) ||
    resolveAbsoluteUrl(funnelSeo?.ogImageUrl, canonicalOrigin) ||
    resolveAbsoluteUrl(funnelSeo?.ogImage, canonicalOrigin) ||
    resolveAbsoluteUrl(funnelSeo?.image, canonicalOrigin) ||
    resolveAbsoluteUrl(fallbackOgImagePath, getFallbackOrigin(), {
      allowFallbackPath: true,
    }) ||
    `${getFallbackOrigin()}${fallbackOgImagePath}`;
  const favicon =
    resolveAbsoluteUrl(publication.faviconUrl, canonicalOrigin) ||
    resolveAbsoluteUrl(funnelSeo?.faviconUrl, canonicalOrigin) ||
    resolveAbsoluteUrl(funnelSeo?.favicon, canonicalOrigin);

  return {
    title,
    description,
    canonicalUrl,
    ogImage: {
      url: ogImageUrl,
      width: 1200,
      height: 630,
      alt: title,
      type: resolveImageContentType(ogImageUrl),
    },
    favicon,
  };
};

export const buildPublicFunnelMetadata = (
  runtime: PublicFunnelRuntimePayload,
): Metadata => {
  const seo = resolvePublicFunnelSeo(runtime);
  const siteName = new URL(seo.canonicalUrl).host;

  return {
    title: seo.title,
    description: seo.description,
    icons: seo.favicon
      ? {
          icon: seo.favicon,
          shortcut: seo.favicon,
        }
      : undefined,
    alternates: {
      canonical: seo.canonicalUrl,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: seo.canonicalUrl,
      siteName,
      type: "website",
      images: [seo.ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [seo.ogImage.url],
    },
  };
};
