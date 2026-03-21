import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber } from "@/lib/app-shell/utils";

export default async function AdminTemplatesPage() {
  const data = await getAppShellSnapshot();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Templates"
        title="Catálogo base de templates"
        description="Superficie de lectura para revisar versiones, tipologías y readiness de los templates administrados por plataforma."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Templates totales"
          value={formatCompactNumber(data.templates.length)}
          hint="Incluye templates activos y drafts listos para evolucionar."
        />
        <KpiCard
          label="Activos"
          value={formatCompactNumber(
            data.templates.filter((item) => item.status === "active").length,
          )}
          hint="Base reusable para equipos y publicaciones."
        />
        <KpiCard
          label="Drafts"
          value={formatCompactNumber(
            data.templates.filter((item) => item.status === "draft").length,
          )}
          hint="Espacio reservado para iteraciones estructurales futuras."
        />
        <KpiCard
          label="Tipos de funnel"
          value={formatCompactNumber(
            new Set(data.templates.map((item) => item.funnelType)).size,
          )}
          hint="La plataforma ya distingue plantillas por intención y formato."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Template",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.name}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {row.code}
                </p>
              </div>
            ),
          },
          {
            key: "workspace",
            header: "Scope",
            render: (row) =>
              row.workspaceId ? "Workspace-scoped" : "Platform base",
          },
          {
            key: "type",
            header: "Tipo",
            render: (row) => row.funnelType,
          },
          {
            key: "version",
            header: "Versión",
            render: (row) => `v${row.version}`,
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => <StatusBadge value={row.status} />,
          },
        ]}
        rows={data.templates}
        emptyTitle="Sin templates disponibles"
        emptyDescription="Cuando el catálogo estructural esté vacío, esta vista quedará preparada para mostrarlo sin romper el shell."
      />
    </div>
  );
}
