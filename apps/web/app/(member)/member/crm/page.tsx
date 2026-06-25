import { AdvisorCrmClient } from "@/components/member-crm/advisor-crm-client";
import {
  type AdvisorCrmInboxSource,
  type AdvisorCrmInboxTab,
  type AdvisorCrmStatusFilter,
} from "@/lib/member-crm";
import { getAdvisorCrmInboxSnapshot } from "@/lib/member-crm.server";

type MemberCrmPageProps = {
  searchParams: Promise<{
    q?: string;
    source?: string;
    status?: string;
    tab?: string;
  }>;
};

const validTabs = new Set<AdvisorCrmInboxTab>([
  "all",
  "handoffs",
  "active",
  "external_matches",
  "duplicates",
]);
const validSources = new Set<AdvisorCrmInboxSource>([
  "all",
  "leadflow",
  "supabase",
]);
const validStatuses = new Set<AdvisorCrmStatusFilter>([
  "all",
  "pending",
  "assigned",
  "pending_assignment",
  "accepted",
  "auto_accepted",
  "reassigned",
  "closed",
  "conversation_started",
]);

const normalizeTab = (value: string | undefined): AdvisorCrmInboxTab =>
  value && validTabs.has(value as AdvisorCrmInboxTab)
    ? (value as AdvisorCrmInboxTab)
    : "all";

const normalizeSource = (value: string | undefined): AdvisorCrmInboxSource =>
  value && validSources.has(value as AdvisorCrmInboxSource)
    ? (value as AdvisorCrmInboxSource)
    : "all";

const normalizeStatus = (value: string | undefined): AdvisorCrmStatusFilter => {
  if (!value) {
    return "all";
  }

  const serializedValue = String(value);

  return (
    [...validStatuses].find((status) => serializedValue.includes(status)) ??
    "all"
  );
};

const loadMemberCrmPage = async ({ searchParams }: MemberCrmPageProps) => {
  try {
    const query = await searchParams;
    const initialTab = normalizeTab(query.tab);
    const initialSource = normalizeSource(query.source);
    const initialStatus = normalizeStatus(query.status);
    const initialSearch = query.q?.trim() ?? "";
    const snapshot = await getAdvisorCrmInboxSnapshot({
      tab: initialTab,
      limit: 50,
      q: initialSearch,
      source: initialSource,
      status: initialStatus,
    });

    return {
      initialSearch,
      initialSnapshot: snapshot,
      initialSource,
      initialStatus,
      initialTab,
    };
  } catch (error) {
    console.error("[member route ssr failed]", {
      route: "/member/crm",
      error,
    });
    throw error;
  }
};

export default async function MemberCrmPage(props: MemberCrmPageProps) {
  const {
    initialSearch,
    initialSnapshot,
    initialSource,
    initialStatus,
    initialTab,
  } = await loadMemberCrmPage(props);

  return (
    <AdvisorCrmClient
      initialSearch={initialSearch}
      initialSnapshot={initialSnapshot}
      initialSource={initialSource}
      initialStatus={initialStatus}
      initialTab={initialTab}
    />
  );
}
