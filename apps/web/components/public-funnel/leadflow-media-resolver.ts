import {
  asMediaItem,
  asRecord,
  extractImageFromMap,
} from "@/components/public-funnel/runtime-block-utils";
import type {
  JsonValue,
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

const ABSOLUTE_MEDIA_URL_PATTERN = /^(https?:)?\/\//i;
const SPECIAL_MEDIA_URL_PATTERN = /^(data:|blob:)/i;

type ResolveLeadflowBlockMediaOptions = {
  runtime: PublicFunnelRuntimePayload;
  fallbackAlt: string;
  block?: RuntimeBlock;
  candidate?: JsonValue;
  preferBlockKeys?: string[];
  fallbackMapKeys?: string[];
  leadflowMetadata?: JsonValue;
  cloudflareStatusJson?: unknown;
};

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");
const trimLeadingSlashes = (value: string) => value.replace(/^\/+/, "");

const toHostCandidate = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
};

const resolveMetadataRecord = (value: JsonValue | undefined) => {
  return asRecord(value) ?? {};
};

const resolvePreferredHost = (
  runtime: PublicFunnelRuntimePayload,
  metadata: Record<string, JsonValue>,
  cloudflareStatusJson: unknown,
) => {
  const cloudflareRecord =
    typeof cloudflareStatusJson === "object" && cloudflareStatusJson
      ? (cloudflareStatusJson as Record<string, unknown>)
      : null;

  const metadataHostCandidates = [
    metadata.assetHost,
    metadata.assetsHost,
    metadata.mediaHost,
    metadata.publicHost,
    metadata.public_hostname,
    metadata.host,
  ];

  for (const candidate of metadataHostCandidates) {
    const host = toHostCandidate(candidate);
    if (host) {
      return host;
    }
  }

  const cloudflareHost = toHostCandidate(cloudflareRecord?.hostname);
  if (cloudflareHost) {
    return cloudflareHost;
  }

  return (
    toHostCandidate(runtime.domain.host) || toHostCandidate(runtime.request.host)
  );
};

const resolvePreferredBaseUrl = (
  runtime: PublicFunnelRuntimePayload,
  metadata: Record<string, JsonValue>,
  cloudflareStatusJson: unknown,
) => {
  const metadataBaseUrlCandidates = [
    metadata.assetBaseUrl,
    metadata.assetsBaseUrl,
    metadata.mediaBaseUrl,
    metadata.cdnBaseUrl,
    metadata.publicBaseUrl,
    metadata.baseUrl,
    metadata.base_url,
  ];

  for (const candidate of metadataBaseUrlCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return trimTrailingSlashes(candidate.trim());
    }
  }

  const host = resolvePreferredHost(runtime, metadata, cloudflareStatusJson);
  return host ? `https://${host}` : "";
};

const absolutizeMediaSrc = (
  src: string,
  runtime: PublicFunnelRuntimePayload,
  metadata: Record<string, JsonValue>,
  cloudflareStatusJson: unknown,
) => {
  const trimmed = src.trim();
  if (!trimmed) {
    return "";
  }

  if (
    ABSOLUTE_MEDIA_URL_PATTERN.test(trimmed) ||
    SPECIAL_MEDIA_URL_PATTERN.test(trimmed)
  ) {
    return trimmed;
  }

  const baseUrl = resolvePreferredBaseUrl(runtime, metadata, cloudflareStatusJson);
  if (!baseUrl) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${baseUrl}${trimmed}`;
  }

  return `${baseUrl}/${trimLeadingSlashes(trimmed)}`;
};

const normalizeResolvedMedia = (
  media: ReturnType<typeof asMediaItem>,
  runtime: PublicFunnelRuntimePayload,
  metadata: Record<string, JsonValue>,
  cloudflareStatusJson: unknown,
) => {
  if (!media) {
    return null;
  }

  return {
    ...media,
    src: absolutizeMediaSrc(media.src, runtime, metadata, cloudflareStatusJson),
  };
};

const resolveMediaFromMaps = (
  key: string,
  runtime: PublicFunnelRuntimePayload,
  metadata: Record<string, JsonValue>,
  fallbackAlt: string,
  cloudflareStatusJson: unknown,
) => {
  const metadataMediaMap = metadata.mediaMap;
  const mediaMaps: Array<JsonValue | undefined> = [
    metadataMediaMap,
    runtime.currentStep.mediaMap,
    runtime.funnel.mediaMap,
    runtime.funnel.template.mediaMap,
  ];

  for (const map of mediaMaps) {
    const record = asRecord(map);
    if (!record) {
      continue;
    }

    const media = normalizeResolvedMedia(
      asMediaItem(record[key], fallbackAlt),
      runtime,
      metadata,
      cloudflareStatusJson,
    );
    if (media) {
      return media;
    }
  }

  return null;
};

export function resolveLeadflowBlockMedia({
  runtime,
  fallbackAlt,
  block,
  candidate,
  preferBlockKeys = [],
  fallbackMapKeys = [],
  leadflowMetadata,
  cloudflareStatusJson,
}: ResolveLeadflowBlockMediaOptions) {
  const blockRecord = block ? asRecord(block as JsonValue) : null;
  const metadataRecord = resolveMetadataRecord(leadflowMetadata);
  const values: Array<JsonValue | undefined> = [
    candidate,
    ...preferBlockKeys.map((key) => blockRecord?.[key]),
    blockRecord?.media,
    blockRecord?.image,
    blockRecord?.asset,
    blockRecord?.file,
    blockRecord?.poster,
    blockRecord?.thumbnail,
  ];

  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();

      if (
        ABSOLUTE_MEDIA_URL_PATTERN.test(trimmed) ||
        SPECIAL_MEDIA_URL_PATTERN.test(trimmed) ||
        trimmed.startsWith("/")
      ) {
        return {
          src: absolutizeMediaSrc(
            trimmed,
            runtime,
            metadataRecord,
            cloudflareStatusJson,
          ),
          alt: fallbackAlt,
        };
      }

      const mediaFromMaps = resolveMediaFromMaps(
        trimmed,
        runtime,
        metadataRecord,
        fallbackAlt,
        cloudflareStatusJson,
      );
      if (mediaFromMaps) {
        return mediaFromMaps;
      }

      return {
        src: absolutizeMediaSrc(
          trimmed,
          runtime,
          metadataRecord,
          cloudflareStatusJson,
        ),
        alt: fallbackAlt,
      };
    }

    const directMedia = normalizeResolvedMedia(
      asMediaItem(value as JsonValue | undefined, fallbackAlt),
      runtime,
      metadataRecord,
      cloudflareStatusJson,
    );
    if (directMedia) {
      return directMedia;
    }
  }

  for (const key of fallbackMapKeys) {
    const mediaFromMaps = resolveMediaFromMaps(
      key,
      runtime,
      metadataRecord,
      fallbackAlt,
      cloudflareStatusJson,
    );
    if (mediaFromMaps) {
      return mediaFromMaps;
    }
  }

  return normalizeResolvedMedia(
    extractImageFromMap(
      runtime.currentStep.mediaMap,
      ["hero", "product_box", "heroImage", "coverImage", "image"],
      fallbackAlt,
    ),
    runtime,
    metadataRecord,
    cloudflareStatusJson,
  );
}
