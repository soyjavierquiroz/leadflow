"use client";

import {
  Archive,
  BarChart3,
  CheckCircle2,
  Copy,
  Eye,
  Filter,
  Layers3,
  PenLine,
  Rocket,
  Search,
  Sparkles,
  Star,
  Tags,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type {
  FunnelMarketplaceAsset,
  MarketplaceMode,
} from "@/components/funnel-marketplace/funnel-marketplace-types";
import {
  filterByValue,
  formatNumber,
  getAssetTags,
  getAssetSlug,
  hasMasterFunnel,
  matchesMarketplaceQuery,
  normalizeText,
  statusClassName,
  statusLabel,
} from "@/components/funnel-marketplace/funnel-marketplace-utils";
import { memberOperationRequest } from "@/lib/member-operations";
import type { SystemFunnelMarketplaceMasterFunnelResponse } from "@/lib/system-funnel-arsenal";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type FunnelMarketplaceClientProps = {
  assets: FunnelMarketplaceAsset[];
  mode: MarketplaceMode;
  title: string;
  description: string;
  blueprintKey?: string | null;
  requiresCommercialProfile?: boolean;
};

type Filters = {
  industry: string;
  blueprint: string;
  objective: string;
  type: string;
  language: string;
  market: string;
  framework: string;
  level: string;
  steps: string;
  tag: string;
};

const emptyFilters: Filters = {
  industry: "all",
  blueprint: "all",
  objective: "all",
  type: "all",
  language: "all",
  market: "all",
  framework: "all",
  level: "all",
  steps: "all",
  tag: "all",
};

const selectClassName =
  "h-10 rounded-lg border border-app-border bg-app-card px-3 text-xs font-semibold text-app-text outline-none transition hover:border-app-border-strong focus:border-app-border-strong focus:ring-2 focus:ring-app-accent-soft";

const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-app-accent px-3.5 py-2 text-sm font-semibold text-app-accent-contrast transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-app-border bg-app-card px-3.5 py-2 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const uniqueOptions = (
  assets: FunnelMarketplaceAsset[],
  read: (asset: FunnelMarketplaceAsset) => string | null | undefined,
) =>
  [...new Set(assets.map(read).filter((item): item is string => Boolean(item)))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ label: value, value }));

const stepOptionValue = (steps?: number | null) => {
  if (!steps) return "all";
  if (steps <= 2) return "1-2";
  if (steps <= 5) return "3-5";
  return "6+";
};

function FunnelCover({ asset }: { asset: FunnelMarketplaceAsset }) {
  const imageUrl = asset.thumbnailUrl ?? asset.coverUrl;

  if (imageUrl) {
    return (
      <div
        className="h-36 rounded-lg border border-app-border bg-cover bg-center"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  }

  return (
    <div className="relative h-36 overflow-hidden rounded-lg border border-app-border bg-[linear-gradient(135deg,_rgba(20,184,166,0.22)_0%,_rgba(15,23,42,0.96)_48%,_rgba(245,158,11,0.18)_100%)]">
      <div className="absolute inset-x-4 top-4 h-14 rounded-lg border border-white/10 bg-black/20" />
      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2">
        <span className="h-8 rounded-md bg-white/12" />
        <span className="h-8 rounded-md bg-white/8" />
        <span className="h-8 rounded-md bg-white/10" />
      </div>
    </div>
  );
}

function MarketplaceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-app-text-soft">
      {label}
      <select
        className={selectClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FunnelAssetCard({
  asset,
  mode,
  selected,
  onSelect,
  onEnable,
  onCreateMaster,
  isEnabling,
  isCreatingMaster,
}: {
  asset: FunnelMarketplaceAsset;
  mode: MarketplaceMode;
  selected: boolean;
  onSelect: () => void;
  onEnable?: () => void;
  onCreateMaster?: () => void;
  isEnabling?: boolean;
  isCreatingMaster?: boolean;
}) {
  const masterReady = hasMasterFunnel(asset);
  const detailHref =
    mode === "admin"
      ? `/admin/funnel-marketplace/${getAssetSlug(asset)}`
      : `/member/funnels/${getAssetSlug(asset)}`;
  const previewHref =
    mode === "admin"
      ? `/admin/funnel-marketplace/${getAssetSlug(asset)}/preview`
      : `/member/funnels/${getAssetSlug(asset)}/preview`;

  return (
    <article
      className={`flex min-h-[468px] flex-col rounded-lg border bg-app-surface p-3 transition ${
        selected
          ? "border-app-accent shadow-[0_18px_55px_rgba(20,184,166,0.12)]"
          : "border-app-border hover:border-app-border-strong"
      }`}
    >
      <button className="text-left" type="button" onClick={onSelect}>
        <FunnelCover asset={asset} />
      </button>

      <div className="flex flex-1 flex-col px-1 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${statusClassName(
              asset.status,
            )}`}
          >
            {statusLabel(asset.status)}
          </span>
          <span className="inline-flex items-center rounded-md border border-app-border bg-app-card px-2 py-1 text-[11px] font-semibold text-app-text-muted">
            v{asset.version ?? "1.0.0"}
          </span>
          <span
            className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${
              masterReady
                ? "border-app-success-border bg-app-success-bg text-app-success-text"
                : "border-app-warning-border bg-app-warning-bg text-app-warning-text"
            }`}
          >
            {masterReady
              ? "Master asociado"
              : mode === "member"
                ? "Próximamente"
                : "Sin Master"}
          </span>
          {asset.enabled ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-app-success-border bg-app-success-bg px-2 py-1 text-[11px] font-semibold text-app-success-text">
              <CheckCircle2 className="h-3 w-3" />
              Activo
            </span>
          ) : null}
        </div>

        <Link href={detailHref} className="group">
          <h2 className="mt-3 line-clamp-2 text-lg font-semibold tracking-tight text-app-text group-hover:text-app-accent">
            {asset.label}
          </h2>
        </Link>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-app-text-muted">
          {asset.description}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-app-border bg-app-card p-2.5">
            <dt className="text-app-text-soft">Industria</dt>
            <dd className="mt-1 truncate font-semibold text-app-text">
              {normalizeText(asset.industry ?? asset.vertical)}
            </dd>
          </div>
          <div className="rounded-lg border border-app-border bg-app-card p-2.5">
            <dt className="text-app-text-soft">Pasos</dt>
            <dd className="mt-1 font-semibold text-app-text">
              {asset.stepsCount ?? "N/D"}
            </dd>
          </div>
          <div className="rounded-lg border border-app-border bg-app-card p-2.5">
            <dt className="text-app-text-soft">Blueprint</dt>
            <dd className="mt-1 truncate font-semibold text-app-text">
              {asset.blueprintKey.replace("blueprint.", "")}
            </dd>
          </div>
          <div className="rounded-lg border border-app-border bg-app-card p-2.5">
            <dt className="text-app-text-soft">Rating</dt>
            <dd className="mt-1 flex items-center gap-1 font-semibold text-app-text">
              <Star className="h-3.5 w-3.5 fill-current text-amber-300" />
              4.8
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {getAssetTags(asset).map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-app-border bg-app-card px-2 py-1 text-[11px] font-semibold text-app-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-app-border pt-4">
          {masterReady ? (
            <Link href={previewHref} className={secondaryButtonClassName}>
              <Eye className="h-4 w-4" />
              Preview
            </Link>
          ) : (
            <button className={secondaryButtonClassName} type="button" disabled>
              <Eye className="h-4 w-4" />
              Preview
            </button>
          )}
          {mode === "member" ? (
            <button
              className={primaryButtonClassName}
              type="button"
              disabled={isEnabling || asset.enabled || !masterReady}
              onClick={onEnable}
            >
              <Rocket className="h-4 w-4" />
              {!masterReady
                ? "Próximamente"
                : asset.enabled
                  ? "Activado"
                  : isEnabling
                    ? "Activando..."
                    : "Activar Funnel"}
            </button>
          ) : (
            <>
              {masterReady ? (
                <>
                  {asset.builderUrl ? (
                    <Link
                      href={asset.builderUrl}
                      className={primaryButtonClassName}
                    >
                      <PenLine className="h-4 w-4" />
                      Editar Master
                    </Link>
                  ) : (
                    <button
                      className={primaryButtonClassName}
                      type="button"
                      disabled
                    >
                      <PenLine className="h-4 w-4" />
                      Editar Master
                    </button>
                  )}
                  <Link href={detailHref} className={secondaryButtonClassName}>
                    <Archive className="h-4 w-4" />
                    Versiones
                  </Link>
                </>
              ) : (
                <button
                  className={primaryButtonClassName}
                  type="button"
                  disabled={isCreatingMaster}
                  onClick={onCreateMaster}
                >
                  <UploadCloud className="h-4 w-4" />
                  {isCreatingMaster ? "Creando..." : "Crear Master Funnel"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function SelectedAssetPanel({
  asset,
  mode,
  onCreateMaster,
  isCreatingMaster,
}: {
  asset: FunnelMarketplaceAsset;
  mode: MarketplaceMode;
  onCreateMaster?: () => void;
  isCreatingMaster?: boolean;
}) {
  const masterReady = hasMasterFunnel(asset);
  const detailHref =
    mode === "admin"
      ? `/admin/funnel-marketplace/${getAssetSlug(asset)}`
      : `/member/funnels/${getAssetSlug(asset)}`;
  const previewHref =
    mode === "admin"
      ? `/admin/funnel-marketplace/${getAssetSlug(asset)}/preview`
      : `/member/funnels/${getAssetSlug(asset)}/preview`;

  return (
    <aside className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-auto rounded-lg border border-app-border bg-app-surface p-4 xl:block">
      <FunnelCover asset={asset} />
      <div className="mt-4 flex items-center justify-between gap-3">
        <span
          className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClassName(
            asset.status,
          )}`}
        >
          {statusLabel(asset.status)}
        </span>
        <span className="text-xs font-semibold text-app-text-soft">
          v{asset.version ?? "1.0.0"}
        </span>
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-app-text">
        {asset.headline ?? asset.label}
      </h2>
      <p className="mt-2 text-sm leading-6 text-app-text-muted">
        {asset.description}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {[
          ["Clone Count", formatNumber(asset.cloneCount)],
          ["Active Installations", formatNumber(asset.activeInstallations)],
          ["Favorite Count", formatNumber(asset.favoriteCount)],
          ["Idioma", normalizeText(asset.language)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-app-border bg-app-card p-3"
          >
            <p className="text-[11px] font-semibold text-app-text-soft">
              {label}
            </p>
            <p className="mt-1 text-sm font-semibold text-app-text">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {masterReady ? (
          <Link href={previewHref} className={primaryButtonClassName}>
            <Eye className="h-4 w-4" />
            Preview
          </Link>
        ) : (
          <button className={primaryButtonClassName} type="button" disabled>
            <Eye className="h-4 w-4" />
            Preview
          </button>
        )}
        {mode === "admin" && masterReady && asset.builderUrl ? (
          <Link href={asset.builderUrl} className={secondaryButtonClassName}>
            <PenLine className="h-4 w-4" />
            Editar Master
          </Link>
        ) : null}
        {mode === "admin" && !masterReady ? (
          <button
            className={secondaryButtonClassName}
            type="button"
            disabled={isCreatingMaster}
            onClick={onCreateMaster}
          >
            <UploadCloud className="h-4 w-4" />
            {isCreatingMaster ? "Creando..." : "Crear Master Funnel"}
          </button>
        ) : null}
        <Link href={detailHref} className={secondaryButtonClassName}>
          Ver detalle
        </Link>
      </div>
    </aside>
  );
}

export function FunnelMarketplaceClient({
  assets,
  mode,
  title,
  description,
  blueprintKey,
  requiresCommercialProfile = false,
}: FunnelMarketplaceClientProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selectedSlug, setSelectedSlug] = useState(
    assets[0] ? getAssetSlug(assets[0]) : "",
  );
  const [marketplaceAssets, setMarketplaceAssets] = useState(() =>
    mode === "member" ? assets.filter(hasMasterFunnel) : assets,
  );
  const [enablingSlug, setEnablingSlug] = useState<string | null>(null);
  const [creatingMasterSlug, setCreatingMasterSlug] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const tagOptions = useMemo(
    () =>
      [...new Set(marketplaceAssets.flatMap((asset) => asset.tags ?? []))]
        .sort((left, right) => left.localeCompare(right))
        .map((tag) => ({ label: tag, value: tag })),
    [marketplaceAssets],
  );

  const options = useMemo(
    () => ({
      industry: uniqueOptions(
        marketplaceAssets,
        (asset) => asset.industry ?? asset.vertical,
      ),
      blueprint: uniqueOptions(
        marketplaceAssets,
        (asset) => asset.blueprintKey,
      ),
      objective: uniqueOptions(
        marketplaceAssets,
        (asset) => asset.objective ?? asset.goal,
      ),
      type: uniqueOptions(marketplaceAssets, (asset) => asset.funnelType),
      language: uniqueOptions(marketplaceAssets, (asset) => asset.language),
      market: uniqueOptions(marketplaceAssets, (asset) => asset.market),
      framework: uniqueOptions(marketplaceAssets, (asset) => asset.framework),
      level: uniqueOptions(
        marketplaceAssets,
        (asset) => asset.level ?? asset.difficulty,
      ),
    }),
    [marketplaceAssets],
  );

  const filteredAssets = useMemo(
    () =>
      marketplaceAssets.filter((asset) => {
        const stepsValue = stepOptionValue(asset.stepsCount);

        return (
          matchesMarketplaceQuery(asset, query) &&
          filterByValue(asset.industry ?? asset.vertical, filters.industry) &&
          filterByValue(asset.blueprintKey, filters.blueprint) &&
          filterByValue(asset.objective ?? asset.goal, filters.objective) &&
          filterByValue(asset.funnelType, filters.type) &&
          filterByValue(asset.language, filters.language) &&
          filterByValue(asset.market, filters.market) &&
          filterByValue(asset.framework, filters.framework) &&
          filterByValue(asset.level ?? asset.difficulty, filters.level) &&
          (filters.steps === "all" || stepsValue === filters.steps) &&
          (filters.tag === "all" || (asset.tags ?? []).includes(filters.tag))
        );
      }),
    [filters, marketplaceAssets, query],
  );

  const selectedAsset =
    filteredAssets.find((asset) => getAssetSlug(asset) === selectedSlug) ??
    filteredAssets[0] ??
    marketplaceAssets[0];

  const updateFilter = <Key extends keyof Filters>(key: Key, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleEnable = (asset: FunnelMarketplaceAsset) => {
    setEnablingSlug(getAssetSlug(asset));
    setFeedback(null);

    startTransition(async () => {
      try {
        const enabled = await memberOperationRequest<FunnelMarketplaceAsset>(
          `/funnel-arsenal/me/${encodeURIComponent(asset.templateKey)}/enable`,
          { method: "POST" },
        );

        setMarketplaceAssets((current) =>
          current.map((item) =>
            item.templateKey === enabled.templateKey ? enabled : item,
          ),
        );
        setFeedback({ tone: "success", message: "Funnel activado." });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos activar el Funnel.",
        });
      } finally {
        setEnablingSlug(null);
      }
    });
  };

  const handleCreateMaster = (asset: FunnelMarketplaceAsset) => {
    const assetSlug = getAssetSlug(asset);
    setCreatingMasterSlug(assetSlug);
    setFeedback(null);

    startTransition(async () => {
      try {
        const created =
          await authenticatedOperationRequest<SystemFunnelMarketplaceMasterFunnelResponse>(
            `/system/funnel-marketplace/${encodeURIComponent(
              assetSlug,
            )}/master-funnel`,
            {
              method: "POST",
              body: JSON.stringify({}),
            },
          );

        setMarketplaceAssets((current) =>
          current.map((item) =>
            getAssetSlug(item) === assetSlug
              ? {
                  ...item,
                  hasMasterFunnel: true,
                  sourceFunnelId: created.sourceFunnelId,
                  sourceFunnelInstanceId: created.sourceFunnelInstanceId,
                  builderUrl: created.builderUrl,
                }
              : item,
          ),
        );
        setFeedback({ tone: "success", message: "Master Funnel creado." });
        window.open(created.builderUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos crear el Master Funnel.",
        });
      } finally {
        setCreatingMasterSlug(null);
      }
    });
  };

  if (requiresCommercialProfile) {
    return (
      <section className="rounded-lg border border-app-warning-border bg-app-warning-bg p-5 text-app-warning-text">
        <h1 className="text-lg font-semibold">Completa tu perfil comercial</h1>
        <p className="mt-2 text-sm leading-6">
          Necesitamos tu blueprint para mostrarte Funnels compatibles.
        </p>
      </section>
    );
  }

  return (
    <div className="w-full space-y-6">
      <section className="rounded-lg border border-app-border bg-app-surface p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-app-text-soft">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-app-border bg-app-card px-2 py-1">
                <Sparkles className="h-3.5 w-3.5" />
                Funnels
              </span>
              {blueprintKey ? (
                <span className="rounded-md border border-app-border bg-app-card px-2 py-1">
                  {blueprintKey}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-app-text">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-app-text-muted">
              {description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                label: "Funnels",
                value: marketplaceAssets.length,
                Icon: Layers3,
              },
              {
                label: "Published",
                value: marketplaceAssets.filter(
                  (item) => item.status === "active",
                ).length,
                Icon: UploadCloud,
              },
              {
                label: "Clones",
                value: marketplaceAssets.reduce(
                  (sum, item) => sum + (item.cloneCount ?? 0),
                  0,
                ),
                Icon: Copy,
              },
              {
                label: "Activos",
                value: marketplaceAssets.reduce(
                  (sum, item) => sum + (item.activeInstallations ?? 0),
                  0,
                ),
                Icon: BarChart3,
              },
            ].map(({ label, value, Icon }) => (
              <div
                key={label}
                className="rounded-lg border border-app-border bg-app-card p-3"
              >
                <Icon className="h-4 w-4 text-app-text-soft" />
                <p className="mt-2 text-lg font-semibold text-app-text">
                  {formatNumber(value)}
                </p>
                <p className="text-[11px] font-semibold text-app-text-soft">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="rounded-lg border border-app-border bg-app-surface p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-soft" />
            <input
              className="h-11 w-full rounded-lg border border-app-border bg-app-card pl-10 pr-3 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-border-strong focus:ring-2 focus:ring-app-accent-soft"
              value={query}
              placeholder="Buscar por nombre, objetivo, industria, blueprint o tags"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            className={secondaryButtonClassName}
            type="button"
            onClick={() => {
              setFilters(emptyFilters);
              setQuery("");
            }}
          >
            <Filter className="h-4 w-4" />
            Limpiar filtros
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MarketplaceSelect
            label="Industria"
            value={filters.industry}
            options={options.industry}
            onChange={(value) => updateFilter("industry", value)}
          />
          <MarketplaceSelect
            label="Blueprint"
            value={filters.blueprint}
            options={options.blueprint}
            onChange={(value) => updateFilter("blueprint", value)}
          />
          <MarketplaceSelect
            label="Objetivo"
            value={filters.objective}
            options={options.objective}
            onChange={(value) => updateFilter("objective", value)}
          />
          <MarketplaceSelect
            label="Tipo"
            value={filters.type}
            options={options.type}
            onChange={(value) => updateFilter("type", value)}
          />
          <MarketplaceSelect
            label="Idioma"
            value={filters.language}
            options={options.language}
            onChange={(value) => updateFilter("language", value)}
          />
          <MarketplaceSelect
            label="Mercado"
            value={filters.market}
            options={options.market}
            onChange={(value) => updateFilter("market", value)}
          />
          <MarketplaceSelect
            label="Framework"
            value={filters.framework}
            options={options.framework}
            onChange={(value) => updateFilter("framework", value)}
          />
          <MarketplaceSelect
            label="Nivel"
            value={filters.level}
            options={options.level}
            onChange={(value) => updateFilter("level", value)}
          />
          <MarketplaceSelect
            label="Pasos"
            value={filters.steps}
            options={[
              { label: "1-2", value: "1-2" },
              { label: "3-5", value: "3-5" },
              { label: "6+", value: "6+" },
            ]}
            onChange={(value) => updateFilter("steps", value)}
          />
          <MarketplaceSelect
            label="Tags"
            value={filters.tag}
            options={tagOptions}
            onChange={(value) => updateFilter("tag", value)}
          />
        </div>
      </section>

      {filteredAssets.length === 0 ? (
        <section className="rounded-lg border border-app-border bg-app-surface p-8 text-center">
          <Tags className="mx-auto h-8 w-8 text-app-text-soft" />
          <h2 className="mt-3 text-lg font-semibold text-app-text">
            No hay Funnels con estos filtros
          </h2>
          <p className="mt-2 text-sm text-app-text-muted">
            Ajusta búsqueda, blueprint, industria o tags para ampliar
            resultados.
          </p>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredAssets.map((asset) => (
              <FunnelAssetCard
                key={getAssetSlug(asset)}
                asset={asset}
                mode={mode}
                selected={
                  selectedAsset
                    ? getAssetSlug(selectedAsset) === getAssetSlug(asset)
                    : false
                }
                onSelect={() => setSelectedSlug(getAssetSlug(asset))}
                onEnable={
                  mode === "member" ? () => handleEnable(asset) : undefined
                }
                onCreateMaster={
                  mode === "admin" ? () => handleCreateMaster(asset) : undefined
                }
                isEnabling={enablingSlug === getAssetSlug(asset)}
                isCreatingMaster={creatingMasterSlug === getAssetSlug(asset)}
              />
            ))}
          </section>
          {selectedAsset ? (
            <SelectedAssetPanel
              asset={selectedAsset}
              mode={mode}
              onCreateMaster={
                mode === "admin"
                  ? () => handleCreateMaster(selectedAsset)
                  : undefined
              }
              isCreatingMaster={
                creatingMasterSlug === getAssetSlug(selectedAsset)
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
