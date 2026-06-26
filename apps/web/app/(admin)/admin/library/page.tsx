import Link from "next/link";
import { getLeadflowLibrarySnapshot } from "@/lib/leadflow-library";
import { logCriticalSsrError } from "@/lib/ssr-debug";

const formatCount = (value: number, singular: string, plural: string) =>
  `${value} ${value === 1 ? singular : plural}`;

const compact = (values: Array<string | null | undefined>) =>
  values.filter((value): value is string => Boolean(value && value.trim()));

export default async function AdminLeadflowLibraryPage() {
  let snapshot: Awaited<ReturnType<typeof getLeadflowLibrarySnapshot>>;

  try {
    snapshot = await getLeadflowLibrarySnapshot();
  } catch (error) {
    logCriticalSsrError(error, {
      page: "/admin/library",
      operation: "AdminLeadflowLibraryPage",
    });
    throw error;
  }

  const collectionsCount = snapshot.collections.length;
  const assets = snapshot.collections.flatMap((collection) =>
    collection.assets.map((asset) => ({
      ...asset,
      collectionTitle: collection.title,
    })),
  );
  const versions = assets.flatMap((asset) => asset.versions);
  const publishedVersions = versions.filter(
    (version) => version.status === "published",
  );
  const mediaCount = versions.reduce(
    (total, version) => total + version.media.length,
    0,
  );
  const compatibilityCount = versions.reduce(
    (total, version) => total + version.compatibility.length,
    0,
  );

  return (
    <main className="w-full space-y-6">
      <section className="w-full border-b border-app-shell-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
          LeadFlow Library
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-app-shell-text">
              Biblioteca de assets
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-shell-muted">
              Foundation para distribuir funnels, blocks, themes, prompt packs,
              agentes y assets futuros con versiones publicadas como origen
              activable.
            </p>
          </div>
          <Link
            href="/admin/funnel-marketplace"
            className="inline-flex items-center justify-center rounded-lg border border-app-shell-border bg-app-shell-surface px-4 py-2 text-sm font-semibold text-app-shell-text hover:border-app-accent"
          >
            Ver Marketplace actual
          </Link>
        </div>
      </section>

      <section className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Collections", collectionsCount],
          ["Assets", assets.length],
          ["Published", publishedVersions.length],
          ["Media", mediaCount],
          ["Compatibility", compatibilityCount],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-app-shell-border bg-app-shell-surface p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-shell-muted">
              {label}
            </p>
            <p className="mt-3 text-2xl font-semibold text-app-shell-text">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="grid w-full gap-5 xl:grid-cols-[0.9fr_1.3fr]">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-app-shell-text">
              Collections
            </h2>
            <p className="mt-1 text-sm text-app-shell-muted">
              Punto de entrada por familia de asset.
            </p>
          </div>

          {snapshot.collections.length > 0 ? (
            snapshot.collections.map((collection) => (
              <article
                key={collection.id}
                className="rounded-lg border border-app-shell-border bg-app-shell-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-app-shell-text">
                      {collection.title}
                    </h3>
                    <p className="mt-1 text-xs text-app-shell-muted">
                      {collection.slug}
                    </p>
                  </div>
                  <span className="rounded-md border border-app-shell-border px-2 py-1 text-xs font-semibold text-app-shell-muted">
                    {collection.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-app-shell-muted">
                  {collection.description ?? "Sin descripcion registrada."}
                </p>
                <p className="mt-4 text-sm font-semibold text-app-shell-text">
                  {formatCount(collection.assets.length, "asset", "assets")}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-app-shell-border bg-app-shell-surface p-5">
              <h3 className="font-semibold text-app-shell-text">
                Sin collections todavía
              </h3>
              <p className="mt-2 text-sm leading-6 text-app-shell-muted">
                La estructura ya existe para crear Funnels, Blocks, AI Agents,
                Prompt Packs y más familias sin acoplarlas al Marketplace.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-app-shell-text">
              Assets y versiones
            </h2>
            <p className="mt-1 text-sm text-app-shell-muted">
              Solo las versiones published deben convertirse en origen de
              preview y activacion.
            </p>
          </div>

          {assets.length > 0 ? (
            assets.map((asset) => (
              <article
                key={asset.id}
                className="rounded-lg border border-app-shell-border bg-app-shell-surface p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-accent">
                      {asset.collectionTitle}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-app-shell-text">
                      {asset.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-app-shell-muted">
                      {asset.description ?? asset.slug}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[asset.assetType, asset.visibility, asset.status].map(
                      (label) => (
                        <span
                          key={label}
                          className="rounded-md border border-app-shell-border px-2 py-1 text-xs font-semibold text-app-shell-muted"
                        >
                          {label}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                <div className="mt-4 divide-y divide-app-shell-border border-y border-app-shell-border">
                  {asset.versions.map((version) => {
                    const funnel = version.funnelVersion;
                    const compatibilityLabels = version.compatibility.flatMap(
                      (item) =>
                        compact([
                          item.vertical,
                          item.industry,
                          item.businessModel,
                          item.blueprint,
                          item.country,
                          item.language,
                          item.accountType,
                          item.market,
                        ]),
                    );

                    return (
                      <div
                        key={version.id}
                        className="py-3"
                      >
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-app-shell-text">
                              v{version.version}
                            </p>
                            <p className="mt-1 text-xs text-app-shell-muted">
                              {funnel?.sourceFunnelInstanceId ??
                                "Sin Master Funnel asociado"}
                            </p>
                          </div>
                          <span className="rounded-md border border-app-shell-border px-2 py-1 text-xs font-semibold text-app-shell-muted">
                            {version.status}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-3 text-sm text-app-shell-muted sm:grid-cols-3">
                          <p>
                            {formatCount(
                              version.media.length,
                              "media",
                              "media",
                            )}
                          </p>
                          <p>
                            {formatCount(
                              version.compatibility.length,
                              "compatibilidad",
                              "compatibilidades",
                            )}
                          </p>
                          <p>
                            {formatCount(
                              version.legacyFunnelArsenalTemplateCount,
                              "adapter",
                              "adapters",
                            )}
                          </p>
                        </div>

                        {compatibilityLabels.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {[...new Set(compatibilityLabels)].map((label) => (
                              <span
                                key={label}
                                className="rounded-md bg-app-accent-soft px-2 py-1 text-xs font-semibold text-app-accent"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-app-shell-border bg-app-shell-surface p-5">
              <h3 className="font-semibold text-app-shell-text">
                Listo para migrar assets
              </h3>
              <p className="mt-2 text-sm leading-6 text-app-shell-muted">
                El siguiente paso es asociar funnels existentes a
                LibraryAssetVersion y LibraryFunnelVersion sin eliminar
                FunnelArsenalTemplate.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
