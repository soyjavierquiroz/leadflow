import { SystemTenantsClient } from "@/components/system/system-tenants-client";
import { logCriticalSsrError } from "@/lib/ssr-debug";
import { getSystemTenants } from "@/lib/system-tenants";

export default async function AdminTenantsPage() {
  try {
    const tenants = await getSystemTenants({ includeArchived: true });

    return <SystemTenantsClient initialRows={tenants} />;
  } catch (error) {
    logCriticalSsrError(error, {
      page: "/admin/tenants",
      operation: "AdminTenantsPage",
    });
    throw error;
  }
}
