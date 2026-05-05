import { SystemKreditsClient } from "@/components/system/system-kredits-client";
import { getSystemKreditDirectory } from "@/lib/system-kredits";
import { logCriticalSsrError } from "@/lib/ssr-debug";

export const dynamic = "force-dynamic";

export default async function AdminKreditsPage() {
  try {
    const rows = await getSystemKreditDirectory();

    return <SystemKreditsClient initialRows={rows} />;
  } catch (error) {
    logCriticalSsrError(error, {
      page: "/admin/kredits",
      operation: "AdminKreditsPage",
    });
    throw error;
  }
}
