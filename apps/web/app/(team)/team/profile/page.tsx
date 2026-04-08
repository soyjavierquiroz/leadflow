import { ProfileSettingsClient } from "@/components/settings/profile-settings-client";
import { getMyProfileSnapshot } from "@/lib/profile-settings";

export default async function TeamProfilePage() {
  const profile = await getMyProfileSnapshot();

  return <ProfileSettingsClient initialProfile={profile} scope="team" />;
}
