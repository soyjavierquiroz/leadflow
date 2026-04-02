import { SystemTemplatesClient } from "@/components/system/system-templates-client";
import { getSystemFunnelTemplates } from "@/lib/system-tenants";

export default async function AdminTemplatesPage() {
  const templates = await getSystemFunnelTemplates();

  return <SystemTemplatesClient initialRows={templates} />;
}
