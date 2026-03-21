import { MemberChannelClient } from "@/components/member-operations/member-channel-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function MemberChannelPage() {
  const data = await getAppShellSnapshot();

  return <MemberChannelClient sponsor={data.currentSponsor} />;
}
