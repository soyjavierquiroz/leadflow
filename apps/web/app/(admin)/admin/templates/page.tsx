import { SystemTemplatesClient } from "@/components/system/system-templates-client";
import { getSystemTemplates, getSystemTenants } from "@/lib/system-tenants";

export default async function AdminTemplatesPage() {
  const [templates, teams] = await Promise.all([
    getSystemTemplates(),
    getSystemTenants(),
  ]);

  return <SystemTemplatesClient initialRows={templates} teams={teams} />;
}
