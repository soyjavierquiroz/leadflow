import { SystemFunnelArsenalClient } from "@/components/system/system-funnel-arsenal-client";
import { getSystemFunnelArsenalTemplates } from "@/lib/system-funnel-arsenal";
import { logCriticalSsrError } from "@/lib/ssr-debug";

export default async function AdminFunnelArsenalPage() {
  try {
    const templates = await getSystemFunnelArsenalTemplates();

    return <SystemFunnelArsenalClient initialTemplates={templates} />;
  } catch (error) {
    logCriticalSsrError(error, {
      page: "/admin/funnel-arsenal",
      operation: "AdminFunnelArsenalPage",
    });
    throw error;
  }
}
