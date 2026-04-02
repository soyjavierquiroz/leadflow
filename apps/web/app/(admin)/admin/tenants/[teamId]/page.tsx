import { notFound } from "next/navigation";
import { TenantImmersionClient } from "@/components/system/tenant-immersion-client";
import {
  getSystemTenant,
  getSystemTenantDomains,
  getSystemTenantFunnels,
} from "@/lib/system-tenants";

export const dynamic = "force-dynamic";

type AdminTenantImmersionPageProps = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function AdminTenantImmersionPage({
  params,
}: AdminTenantImmersionPageProps) {
  const { teamId } = await params;
  const tenant = await getSystemTenant(teamId);

  if (!tenant) {
    notFound();
  }

  const [funnels, domains] = await Promise.all([
    getSystemTenantFunnels(teamId),
    getSystemTenantDomains(teamId),
  ]);

  return (
    <TenantImmersionClient
      teamId={teamId}
      initialTenant={tenant}
      initialDomains={domains}
      initialFunnels={funnels}
    />
  );
}
