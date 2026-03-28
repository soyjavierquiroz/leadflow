import { TeamVslPublicationEditor } from "@/components/team-operations/team-vsl-publication-editor";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function TeamPublicationsNewVslPage() {
  const data = await getAppShellSnapshot();

  return (
    <TeamVslPublicationEditor
      domains={data.domains.filter(
        (item) => item.teamId === data.currentTeam.id && item.status === "active",
      )}
      templates={data.templates.filter((item) => item.status !== "archived")}
    />
  );
}
