import { SystemTemplatesClient } from "@/components/system/system-templates-client";
import { logCriticalSsrError } from "@/lib/ssr-debug";
import { getSystemTemplates, getSystemTenants } from "@/lib/system-tenants";

export default async function AdminTemplatesPage() {
  try {
    const [templates, teams] = await Promise.all([
      getSystemTemplates(),
      getSystemTenants(),
    ]);

    return <SystemTemplatesClient initialRows={templates} teams={teams} />;
  } catch (error) {
    logCriticalSsrError(error, {
      page: "/admin/templates",
      operation: "AdminTemplatesPage",
    });
    throw error;
  }
}
