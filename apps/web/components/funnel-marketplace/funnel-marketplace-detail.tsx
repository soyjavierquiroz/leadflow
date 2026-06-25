"use client";

import {
  Archive,
  Clock3,
  Copy,
  Eye,
  Film,
  History,
  Image as ImageIcon,
  Layers3,
  PenLine,
  Rocket,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { FunnelActivateButton } from "@/components/funnel-marketplace/funnel-activate-button";
import type {
  FunnelMarketplaceAsset,
  MarketplaceMode,
} from "@/components/funnel-marketplace/funnel-marketplace-types";
import {
  formatNumber,
  getAssetTags,
  getAssetSlug,
  hasMasterFunnel,
  normalizeText,
  readFlowItems,
  readStringArray,
  statusClassName,
  statusLabel,
} from "@/components/funnel-marketplace/funnel-marketplace-utils";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type { SystemFunnelMarketplaceMasterFunnelResponse } from "@/lib/system-funnel-arsenal";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type FunnelMarketplaceDetailProps = {
  asset: FunnelMarketplaceAsset;
  mode: MarketplaceMode;
};

const buttonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-app-border bg-app-card px-3.5 py-2 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted";

const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-app-accent px-3.5 py-2 text-sm font-semibold text-app-accent-contrast transition hover:opacity-90";

const panelClassName = "rounded-lg border border-app-border bg-app-surface p-5";

const readNamedItems = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: Array<{ label: string; description?: string } | null> =
    value.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const label =
        typeof record.label === "string"
          ? record.label
          : typeof record.name === "string"
            ? record.name
            : null;

      if (!label) return null;

      return {
        label,
        description:
          typeof record.description === "string"
            ? record.description
            : undefined,
      };
    });

  return items.filter((item): item is { label: string; description?: string } =>
    Boolean(item),
  );
};

function MediaFrame({
  asset,
  compact = false,
}: {
  asset: FunnelMarketplaceAsset;
  compact?: boolean;
}) {
  const imageUrl = asset.coverUrl ?? asset.thumbnailUrl;

  if (imageUrl) {
    return (
      <div
        className={`rounded-lg border border-app-border bg-cover bg-center ${
          compact ? "h-32" : "min-h-[320px]"
        }`}
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-app-border bg-[linear-gradient(135deg,_rgba(20,184,166,0.24)_0%,_rgba(15,23,42,0.98)_52%,_rgba(245,158,11,0.20)_100%)] ${
        compact ? "h-32" : "min-h-[320px]"
      }`}
    >
      <div className="absolute left-6 right-6 top-6 h-20 rounded-lg border border-white/10 bg-black/25" />
      <div className="absolute bottom-6 left-6 right-6 grid grid-cols-3 gap-3">
        <span className="h-14 rounded-lg bg-white/12" />
        <span className="h-14 rounded-lg bg-white/8" />
        <span className="h-14 rounded-lg bg-white/10" />
      </div>
    </div>
  );
}

export function FunnelMarketplaceDetail({
  asset,
  mode,
}: FunnelMarketplaceDetailProps) {
  const [currentAsset, setCurrentAsset] = useState(asset);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const assetSlug = getAssetSlug(currentAsset);
  const previewHref =
    mode === "admin"
      ? `/admin/funnel-marketplace/${assetSlug}/preview`
      : `/member/funnels/${assetSlug}/preview`;
  const masterReady = hasMasterFunnel(currentAsset);
  const flowItems = readFlowItems(currentAsset.flowSummary);
  const screenshots = readStringArray(currentAsset.screenshots);
  const history = readNamedItems(currentAsset.history);
  const assets = readNamedItems(currentAsset.assets);
  const media = readNamedItems(currentAsset.media);

  const handleCreateMaster = () => {
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

        setCurrentAsset((current) => ({
          ...current,
          hasMasterFunnel: true,
          sourceFunnelId: created.sourceFunnelId,
          sourceFunnelInstanceId: created.sourceFunnelInstanceId,
          builderUrl: created.builderUrl,
        }));
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
      }
    });
  };

  return (
    <div className="w-full space-y-6">
      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}
      <section className="grid gap-6 rounded-lg border border-app-border bg-app-surface p-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClassName(
                  asset.status,
                )}`}
              >
                {statusLabel(asset.status)}
              </span>
              <span className="rounded-md border border-app-border bg-app-card px-2 py-1 text-xs font-semibold text-app-text-muted">
                v{asset.version ?? "1.0.0"}
              </span>
              <span className="rounded-md border border-app-border bg-app-card px-2 py-1 text-xs font-semibold text-app-text-muted">
                {normalizeText(asset.blueprintKey)}
              </span>
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-app-text">
              {currentAsset.headline ?? currentAsset.label}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-app-text-muted">
              {currentAsset.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
            {mode === "admin" ? (
              <>
                {!masterReady ? (
                  <button
                    className={primaryButtonClassName}
                    type="button"
                    disabled={isPending}
                    onClick={handleCreateMaster}
                  >
                    <UploadCloud className="h-4 w-4" />
                    {isPending ? "Creando..." : "Crear Master Funnel"}
                  </button>
                ) : currentAsset.builderUrl ? (
                  <Link
                    href={currentAsset.builderUrl}
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
                <button className={buttonClassName} type="button">
                  <Archive className="h-4 w-4" />
                  Versiones
                </button>
                <button className={buttonClassName} type="button">
                  <Copy className="h-4 w-4" />
                  Clonar de prueba
                </button>
              </>
            ) : (
              <FunnelActivateButton
                templateKey={asset.templateKey}
                disabled={asset.enabled || !masterReady}
                disabledLabel={
                  masterReady
                    ? undefined
                    : "Este funnel estará disponible pronto."
                }
              />
            )}
          </div>
        </div>

        <MediaFrame asset={asset} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Objetivo", normalizeText(asset.objective ?? asset.goal), Layers3],
          ["Pasos", String(asset.stepsCount ?? "N/D"), Clock3],
          ["Clone Count", formatNumber(asset.cloneCount), Copy],
          [
            "Active Installations",
            formatNumber(asset.activeInstallations),
            Rocket,
          ],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className={panelClassName}>
            <Icon className="h-4 w-4 text-app-text-soft" />
            <p className="mt-3 text-xs font-semibold text-app-text-soft">
              {String(label)}
            </p>
            <p className="mt-1 text-lg font-semibold text-app-text">
              {String(value)}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className={panelClassName}>
            <h2 className="text-lg font-semibold text-app-text">Descripción</h2>
            <p className="mt-3 text-sm leading-7 text-app-text-muted">
              {currentAsset.problemSolved ?? currentAsset.description}
            </p>
          </section>

          <section className={panelClassName}>
            <h2 className="text-lg font-semibold text-app-text">
              Flow resumido
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(flowItems.length > 0
                ? flowItems
                : [
                    { label: "Landing", description: asset.description },
                    { label: "Conversión", description: currentAsset.cta },
                  ]
              ).map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  className="rounded-lg border border-app-border bg-app-card p-4"
                >
                  <p className="text-xs font-semibold text-app-text-soft">
                    Paso {index + 1}
                  </p>
                  <h3 className="mt-1 font-semibold text-app-text">
                    {item.label}
                  </h3>
                  {item.description ? (
                    <p className="mt-2 text-sm leading-6 text-app-text-muted">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className={panelClassName}>
            <h2 className="text-lg font-semibold text-app-text">Screenshots</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {screenshots.length > 0 ? (
                screenshots.map((screenshot) => (
                  <div
                    key={screenshot}
                    className="h-32 rounded-lg border border-app-border bg-cover bg-center"
                    style={{ backgroundImage: `url(${screenshot})` }}
                  />
                ))
              ) : (
                <>
                  <MediaFrame asset={asset} compact />
                  <MediaFrame asset={asset} compact />
                  <MediaFrame asset={asset} compact />
                </>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className={panelClassName}>
            <h2 className="text-lg font-semibold text-app-text">Ideal para</h2>
            {!masterReady ? (
              <p className="mb-3 rounded-lg border border-app-warning-border bg-app-warning-bg px-3 py-2 text-sm font-semibold text-app-warning-text">
                Este funnel aún no tiene un Master Funnel asociado.
              </p>
            ) : null}
            <p className="mt-3 text-sm leading-7 text-app-text-muted">
              {asset.idealFor ?? asset.recommendedFor}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {getAssetTags(asset).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-app-border bg-app-card px-2 py-1 text-xs font-semibold text-app-text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section className={panelClassName}>
            <h2 className="text-lg font-semibold text-app-text">
              Blueprints compatibles
            </h2>
            <div className="mt-3 space-y-2">
              {(asset.compatibleBlueprints?.length
                ? asset.compatibleBlueprints
                : [asset.blueprintKey]
              ).map((blueprint) => (
                <p
                  key={blueprint}
                  className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-semibold text-app-text"
                >
                  {blueprint}
                </p>
              ))}
            </div>
          </section>

          <section className={panelClassName}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-app-text">
              <History className="h-4 w-4" />
              Versiones e historial
            </h2>
            <div className="mt-3 space-y-2 text-sm text-app-text-muted">
              <p>Versión actual: v{asset.version ?? "1.0.0"}</p>
              <p>Autor: {normalizeText(asset.authorName)}</p>
              <p>Last Activated: {asset.lastActivatedAt ?? "N/D"}</p>
              {history.map((item) => (
                <p key={item.label}>{item.label}</p>
              ))}
            </div>
          </section>

          <section className={panelClassName}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-app-text">
              <ImageIcon className="h-4 w-4" />
              Assets y Media
            </h2>
            <div className="mt-3 space-y-2 text-sm text-app-text-muted">
              <p>Cover: {asset.coverUrl ? "Disponible" : "Pendiente"}</p>
              <p>
                Thumbnail: {asset.thumbnailUrl ? "Disponible" : "Pendiente"}
              </p>
              <p className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                Video Preview:{" "}
                {asset.videoPreviewUrl ? "Disponible" : "Pendiente"}
              </p>
              {[...assets, ...media].map((item) => (
                <p key={item.label}>{item.label}</p>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
