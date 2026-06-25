import { CommercialProfileClient } from "@/components/member-operations/commercial-profile-client";
import { requireOperationalViewUser } from "@/lib/auth";
import { getCommercialProfileSnapshot } from "@/lib/commercial-profile";

export default async function MemberCommercialProfilePage() {
  const user = await requireOperationalViewUser();
  const snapshot = await getCommercialProfileSnapshot();

  return (
    <CommercialProfileClient
      fallbackBusinessName={user.team?.name ?? user.workspace?.name ?? ""}
      initialSnapshot={snapshot}
    />
  );
}
