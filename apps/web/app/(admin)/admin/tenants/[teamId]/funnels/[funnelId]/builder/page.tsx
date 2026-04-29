import { notFound } from "next/navigation";
import { TeamVslPublicationEditor } from "@/components/team-operations/team-vsl-publication-editor";
import { getSystemBlockDefinitions } from "@/lib/system-block-definitions";
import { getSystemPublications } from "@/lib/system-publications";
import {
  getSystemTenant,
  getSystemTenantDomains,
  getWorkspaceFunnelTemplates,
} from "@/lib/system-tenants";

export const dynamic = "force-dynamic";

type AdminTenantFunnelBuilderPageProps = {
  params: Promise<{
    teamId: string;
    funnelId: string;
  }>;
};

const pickBuilderPublication = <
  T extends {
    isPrimary: boolean;
    status: string;
    updatedAt: string;
    pathPrefix: string;
  },
>(
  rows: T[],
) =>
  [...rows].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }

    if ((left.status === "active") !== (right.status === "active")) {
      return left.status === "active" ? -1 : 1;
    }

    if ((left.pathPrefix === "/") !== (right.pathPrefix === "/")) {
      return left.pathPrefix === "/" ? -1 : 1;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  })[0] ?? null;

export default async function AdminTenantFunnelBuilderPage({
  params,
}: AdminTenantFunnelBuilderPageProps) {
  const { teamId, funnelId } = await params;
  const [tenant, domains, publications, blockDefinitions] = await Promise.all([
    getSystemTenant(teamId),
    getSystemTenantDomains(teamId),
    getSystemPublications(),
    getSystemBlockDefinitions(),
  ]);

  if (!tenant) {
    notFound();
  }

  const templates = await getWorkspaceFunnelTemplates(tenant.workspaceId);

  const publication = pickBuilderPublication(
    publications.filter(
      (row) => row.teamId === teamId && row.funnel.legacyFunnelId === funnelId,
    ),
  );

  if (!publication) {
    notFound();
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 text-left dark:bg-slate-950 dark:[background-image:var(--bg-glow-conferencia)] dark:bg-cover dark:bg-fixed dark:bg-center">
      <TeamVslPublicationEditor
        mode="system"
        teamId={teamId}
        initialPublicationId={publication.id}
        editorHref={`/admin/tenants/${encodeURIComponent(teamId)}/funnels/${encodeURIComponent(funnelId)}/builder`}
        backHref={`/admin/tenants/${encodeURIComponent(teamId)}`}
        backLabel="Volver al tenant"
        headerEyebrow={`Super Admin / Tenant / ${tenant.code}`}
        headerTitle={`Funnel Builder de ${tenant.name}`}
        headerDescription="Esta vista reutiliza el builder híbrido real del embudo publicado, incluyendo media dictionary, blocksJson y configuración SEO."
        domains={domains.filter((item) => item.status === "active")}
        templates={templates.filter((item) => item.status !== "archived")}
        availableBlocks={blockDefinitions}
      />
    </div>
  );
}
