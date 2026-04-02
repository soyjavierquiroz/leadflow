import { SystemPublicationsClient } from "@/components/system/system-publications-client";
import { getSystemPublications } from "@/lib/system-publications";
import { getSystemTenants } from "@/lib/system-tenants";

export const dynamic = "force-dynamic";

export default async function AdminPublicationsPage() {
  const [rows, teams] = await Promise.all([
    getSystemPublications(),
    getSystemTenants(),
  ]);

  return <SystemPublicationsClient initialRows={rows} teams={teams} />;
}
