import type { FunnelMarketplaceAsset } from "@/components/funnel-marketplace/funnel-marketplace-types";

export const statusLabel = (status?: string) => {
  switch (status) {
    case "active":
      return "Published";
    case "draft":
      return "Draft";
    case "archived":
      return "Archived";
    default:
      return status ?? "Draft";
  }
};

export const statusClassName = (status?: string) => {
  switch (status) {
    case "active":
      return "border-app-success-border bg-app-success-bg text-app-success-text";
    case "archived":
      return "border-app-border bg-app-card text-app-text-soft";
    default:
      return "border-app-warning-border bg-app-warning-bg text-app-warning-text";
  }
};

export const normalizeText = (value?: string | null) =>
  value?.trim() ? value.trim() : "No definido";

export const formatNumber = (value?: number | null) =>
  new Intl.NumberFormat("es").format(value ?? 0);

export const getAssetSlug = (asset: { assetSlug?: string | null; templateKey: string }) =>
  asset.assetSlug?.trim() || asset.templateKey;

export const hasMasterFunnel = (asset: { hasMasterFunnel?: boolean }) =>
  asset.hasMasterFunnel === true;

export const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
};

export const readFlowItems = (
  value: unknown,
): Array<{ label: string; description?: string }> => {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: Array<{ label: string; description?: string } | null> = value.map(
    (item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const label =
        typeof record.label === "string"
          ? record.label
          : typeof record.title === "string"
            ? record.title
            : null;

      if (!label) {
        return null;
      }

      return {
        label,
        description:
          typeof record.description === "string"
            ? record.description
            : undefined,
      };
    },
  );

  return items.filter(
    (item): item is { label: string; description?: string } => Boolean(item),
  );
};

export const getAssetTags = (asset: FunnelMarketplaceAsset) =>
  [
    ...new Set(
      [
        ...(asset.tags ?? []),
        asset.industry,
        asset.framework,
        asset.market,
        asset.level ?? asset.difficulty,
      ].filter((item): item is string => Boolean(item && item.trim())),
    ),
  ].slice(0, 6);

export const matchesMarketplaceQuery = (
  asset: FunnelMarketplaceAsset,
  query: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    asset.label,
    asset.description,
    asset.headline,
    asset.goal,
    asset.industry,
    asset.subindustry,
    asset.blueprintKey,
    asset.objective,
    asset.funnelType,
    asset.framework,
    asset.market,
    ...(asset.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
};

export const filterByValue = (
  assetValue: string | null | undefined,
  selectedValue: string,
) => selectedValue === "all" || assetValue === selectedValue;
