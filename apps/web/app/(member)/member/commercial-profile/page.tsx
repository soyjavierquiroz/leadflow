import { CommercialProfileClient } from "@/components/member-operations/commercial-profile-client";
import { requireOperationalViewUser } from "@/lib/auth";
import { getCommercialProfileSnapshot } from "@/lib/commercial-profile";

const loadMemberCommercialProfilePage = async () => {
  try {
    const user = await requireOperationalViewUser();
    const snapshot = await getCommercialProfileSnapshot();

    return { snapshot, user };
  } catch (error) {
    console.error("[member route ssr failed]", {
      route: "/member/commercial-profile",
      error,
    });
    throw error;
  }
};

export default async function MemberCommercialProfilePage() {
  const { snapshot, user } = await loadMemberCommercialProfilePage();

  return (
    <CommercialProfileClient
      fallbackBusinessName={user.team?.name ?? user.workspace?.name ?? ""}
      initialSnapshot={snapshot}
    />
  );
}
