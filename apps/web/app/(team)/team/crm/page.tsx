import { TeamCrmClient } from "@/components/team-operations/team-crm-client";
import {
  getTeamCrmInboxSnapshot,
  type UnifiedCrmInboxSource,
  type UnifiedCrmTab,
} from "@/lib/team-crm";

type TeamCrmPageProps = {
  searchParams: Promise<{
    q?: string;
    source?: string;
    tab?: string;
  }>;
};

const validTabs = new Set<UnifiedCrmTab>([
  "all",
  "registered",
  "conversational",
  "duplicates",
  "unassigned",
]);
const validSources = new Set<UnifiedCrmInboxSource>([
  "all",
  "leadflow",
  "supabase",
]);

const normalizeTab = (value: string | undefined): UnifiedCrmTab =>
  value && validTabs.has(value as UnifiedCrmTab)
    ? (value as UnifiedCrmTab)
    : "all";

const normalizeSource = (value: string | undefined): UnifiedCrmInboxSource =>
  value && validSources.has(value as UnifiedCrmInboxSource)
    ? (value as UnifiedCrmInboxSource)
    : "all";

export default async function TeamCrmPage({ searchParams }: TeamCrmPageProps) {
  const query = await searchParams;
  const initialTab = normalizeTab(query.tab);
  const initialSource = normalizeSource(query.source);
  const initialSearch = query.q?.trim() ?? "";
  const snapshot = await getTeamCrmInboxSnapshot({
    tab: initialTab,
    limit: 50,
    q: initialSearch,
    source: initialSource,
  });

  return (
    <TeamCrmClient
      initialSnapshot={snapshot}
      initialSearch={initialSearch}
      initialSource={initialSource}
      initialTab={initialTab}
    />
  );
}
