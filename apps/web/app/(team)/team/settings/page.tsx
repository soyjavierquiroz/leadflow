import { TeamSettingsClient } from "@/components/settings/team-settings-client";
import { getTeamSettingsSnapshot } from "@/lib/team-settings";

export default async function TeamSettingsPage() {
  const settings = await getTeamSettingsSnapshot();

  return <TeamSettingsClient initialSettings={settings} />;
}
