import { notFound } from "next/navigation";
import { SystemTenantTemplateFunnelEditor } from "@/components/system/system-tenant-template-funnel-editor";
import { getSystemTenant, getSystemTenantFunnel } from "@/lib/system-tenants";

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
  const [tenant, funnel] = await Promise.all([
    getSystemTenant(teamId),
    getSystemTenantFunnel(teamId, funnelId),
  ]);

  if (!tenant) {
    notFound();
  }

  if (!funnel) {
    notFound();
  }

  return <SystemTenantTemplateFunnelEditor tenant={tenant} funnel={funnel} />;
}
