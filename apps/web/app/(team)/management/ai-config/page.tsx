import { AiSettingsForm } from "@/components/management/AiSettingsForm";
import { getMyAiSettingsSnapshot } from "@/lib/ai-settings";

export default async function ManagementAiConfigPage() {
  const settings = await getMyAiSettingsSnapshot();

  return <AiSettingsForm initialSettings={settings} />;
}
