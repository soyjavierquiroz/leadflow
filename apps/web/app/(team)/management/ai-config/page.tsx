import { AiSettingsForm } from "@/components/management/AiSettingsForm";
import { getManagementAiSettingsSnapshot } from "@/lib/ai-settings";

export default async function ManagementAiConfigPage() {
  const settings = await getManagementAiSettingsSnapshot();

  return <AiSettingsForm initialSettings={settings} />;
}
