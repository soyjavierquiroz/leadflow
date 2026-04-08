import { notFound } from "next/navigation";
import { SystemTenantTemplateFunnelEditor } from "@/components/system/system-tenant-template-funnel-editor";
import { getSystemTenant, getSystemTenantFunnels } from "@/lib/system-tenants";

export const dynamic = "force-dynamic";

type AdminTenantTemplateFunnelEditPageProps = {
  params: Promise<{
    teamId: string;
    funnelId: string;
  }>;
};

export default async function AdminTenantTemplateFunnelEditPage({
  params,
}: AdminTenantTemplateFunnelEditPageProps) {
  const { teamId, funnelId } = await params;
  const [tenant, funnels] = await Promise.all([
    getSystemTenant(teamId),
    getSystemTenantFunnels(teamId),
  ]);

  if (!tenant) {
    notFound();
  }

  const funnel = funnels.find((item) => item.id === funnelId) ?? null;

  if (!funnel) {
    notFound();
  }

  return <SystemTenantTemplateFunnelEditor tenant={tenant} funnel={funnel} />;
}
