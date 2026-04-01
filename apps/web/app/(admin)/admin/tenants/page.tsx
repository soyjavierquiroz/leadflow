import { SystemTenantsClient } from "@/components/system/system-tenants-client";
import { getSystemTenants } from "@/lib/system-tenants";

export default async function AdminTenantsPage() {
  const tenants = await getSystemTenants();

  return <SystemTenantsClient initialRows={tenants} />;
}
