import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession, getSessionUser } from "@/lib/auth";
import {
  mockAssignments,
  mockDomains,
  mockEvents,
  mockFunnelInstances,
  mockMemberProfile,
  mockPublications,
  mockRotationPools,
  mockSponsors,
  mockTeamMetadata,
  mockTemplates,
  mockWorkspace,
  mockLeads,
} from "@/lib/app-shell/mocks";
import type {
  AppShellSnapshot,
  AssignmentRecord,
  AuthenticatedAppUserRecord,
  CollectionSource,
  DataSourceMode,
  DerivedTeam,
  DomainRecord,
  FunnelInstanceRecord,
  FunnelPublicationRecord,
  FunnelTemplateRecord,
  FunnelView,
  HandoffStrategyRecord,
  LeadRecord,
  LeadRemindersSummary,
  LeadView,
  PublicationView,
  RotationPoolRecord,
  RotationPoolMemberRecord,
  SponsorRecord,
  TeamMetadata,
  TrackingProfileRecord,
  WorkspaceRecord,
} from "@/lib/app-shell/types";

const defaultSponsorId = "3be5f7f2-c6ae-47cb-a2bb-e1c869f7db11";

type CollectionResult<T> = {
  data: T[];
  source: CollectionSource;
};

type SingletonResult<T> = {
  data: T;
  source: CollectionSource;
};

const resolveSourceMode = (
  sources: Record<string, CollectionSource>,
): DataSourceMode => {
  const values = Object.values(sources);

  if (values.every((value) => value === "live")) {
    return "live";
  }

  if (values.every((value) => value === "mock")) {
    return "mock";
  }

  return "hybrid";
};

const fetchCollection = async <T>(
  path: string,
  fallback: T[],
): Promise<CollectionResult<T>> => {
  try {
    const response = await apiFetchWithSession(path);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;

    if (!Array.isArray(payload)) {
      throw new Error("The API payload is not a collection.");
    }

    return {
      data: payload as T[],
      source: "live",
    };
  } catch {
    return {
      data: fallback,
      source: "mock",
    };
  }
};

const fetchSingleton = async <T>(
  path: string,
  fallback: T,
): Promise<SingletonResult<T>> => {
  try {
    const response = await apiFetchWithSession(path);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;

    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new Error("The API payload is not an object.");
    }

    return {
      data: payload as T,
      source: "live",
    };
  } catch {
    return {
      data: fallback,
      source: "mock",
    };
  }
};

const buildTeamCatalog = (ids: string[], workspaceId: string) => {
  if (ids.length === 0) {
    return mockTeamMetadata;
  }

  return ids.map((teamId, index) => {
    const mock = mockTeamMetadata[index] ?? mockTeamMetadata[0];

    return {
      id: teamId,
      workspaceId,
      name:
        ids.length === 1
          ? (mock?.name ?? "Sales Core")
          : (mock?.name ?? `Team ${index + 1}`),
      code: mock?.code ?? `team-${index + 1}`,
      status: mock?.status ?? "active",
      description:
        mock?.description ??
        "Metadata temporal mientras llega el endpoint HTTP de teams.",
      maxSeats: mock?.maxSeats ?? 10,
    } satisfies TeamMetadata;
  });
};

const buildDerivedTeams = (input: {
  workspace: WorkspaceRecord;
  funnelInstances: FunnelInstanceRecord[];
  publications: FunnelPublicationRecord[];
  domains: DomainRecord[];
  sponsors: SponsorRecord[];
  rotationPools: RotationPoolRecord[];
  leads: LeadRecord[];
  assignments: AssignmentRecord[];
}): DerivedTeam[] => {
  const teamIds = Array.from(
    new Set(
      [
        ...input.funnelInstances.map((item) => item.teamId),
        ...input.publications.map((item) => item.teamId),
        ...input.domains.map((item) => item.teamId),
        ...input.sponsors.map((item) => item.teamId),
        ...input.rotationPools.map((item) => item.teamId),
        ...input.assignments.map((item) => item.teamId),
      ].filter(Boolean),
    ),
  );

  const catalog = buildTeamCatalog(teamIds, input.workspace.id);

  return catalog.map((team) => {
    const publicationIds = input.publications
      .filter((item) => item.teamId === team.id)
      .map((item) => item.id);
    const funnelIds = input.funnelInstances
      .filter((item) => item.teamId === team.id)
      .map((item) => item.id);

    return {
      ...team,
      sponsorCount: input.sponsors.filter((item) => item.teamId === team.id)
        .length,
      funnelCount: funnelIds.length,
      publicationCount: publicationIds.length,
      domainCount: input.domains.filter((item) => item.teamId === team.id)
        .length,
      poolCount: input.rotationPools.filter((item) => item.teamId === team.id)
        .length,
      leadCount: input.leads.filter((item) => {
        return (
          (item.funnelInstanceId &&
            funnelIds.includes(item.funnelInstanceId)) ||
          (item.funnelPublicationId &&
            publicationIds.includes(item.funnelPublicationId))
        );
      }).length,
      assignmentCount: input.assignments.filter(
        (item) => item.teamId === team.id,
      ).length,
    };
  });
};

const buildPublicationViews = (input: {
  publications: FunnelPublicationRecord[];
  domains: DomainRecord[];
  funnelInstances: FunnelInstanceRecord[];
  templates: FunnelTemplateRecord[];
  teams: DerivedTeam[];
}): PublicationView[] => {
  return input.publications.map((publication) => {
    const domain = input.domains.find(
      (item) => item.id === publication.domainId,
    );
    const funnel = input.funnelInstances.find(
      (item) => item.id === publication.funnelInstanceId,
    );
    const template = input.templates.find(
      (item) => item.id === funnel?.templateId,
    );
    const team = input.teams.find((item) => item.id === publication.teamId);
    const funnelSettings =
      funnel?.settingsJson &&
      typeof funnel.settingsJson === "object" &&
      !Array.isArray(funnel.settingsJson)
        ? (funnel.settingsJson as Record<string, unknown>)
        : null;
    const hybridEditor =
      funnelSettings?.hybridEditor &&
      typeof funnelSettings.hybridEditor === "object" &&
      !Array.isArray(funnelSettings.hybridEditor)
        ? (funnelSettings.hybridEditor as Record<string, unknown>)
        : null;
    const templateName = template?.name ?? "Template sin referencia";
    const normalizedTemplateName = templateName.toLowerCase();
    const isHybridVsl =
      hybridEditor?.mode === "data-driven-assembly" ||
      normalizedTemplateName.includes("vexercore") ||
      normalizedTemplateName.includes("vsl") ||
      normalizedTemplateName.includes("split 50/50");

    return {
      ...publication,
      domainHost: domain?.host ?? "Host no resuelto",
      funnelName: funnel?.name ?? "Funnel sin instancia",
      funnelCode: funnel?.code ?? "pending",
      templateName,
      isHybridVsl,
      teamName: team?.name ?? "Team sin metadata",
      trackingLabel: publication.trackingProfileId
        ? "Tracking conectado"
        : "Tracking pendiente",
      handoffLabel: publication.handoffStrategyId
        ? "Handoff definido"
        : "Handoff pendiente",
    };
  });
};

const buildFunnelViews = (input: {
  funnelInstances: FunnelInstanceRecord[];
  templates: FunnelTemplateRecord[];
  teams: DerivedTeam[];
  publications: FunnelPublicationRecord[];
}): FunnelView[] => {
  return input.funnelInstances.map((instance) => {
    const template = input.templates.find(
      (item) => item.id === instance.templateId,
    );
    const team = input.teams.find((item) => item.id === instance.teamId);

    return {
      ...instance,
      templateName: template?.name ?? "Template pendiente",
      publicationCount: input.publications.filter(
        (item) => item.funnelInstanceId === instance.id,
      ).length,
      teamName: team?.name ?? "Team sin metadata",
      rotationLabel: instance.rotationPoolId
        ? "Pool asignado"
        : "Pool pendiente",
      trackingReady: Boolean(instance.trackingProfileId),
    };
  });
};

const buildLeadViews = (input: {
  leads: LeadRecord[];
  assignments: AssignmentRecord[];
  sponsors: SponsorRecord[];
  publications: PublicationView[];
  funnels: FunnelView[];
  teams: DerivedTeam[];
}): LeadView[] => {
  return input.leads.map((lead) => {
    const assignment =
      input.assignments.find((item) => item.id === lead.currentAssignmentId) ??
      input.assignments.find((item) => item.leadId === lead.id);
    const sponsor = input.sponsors.find(
      (item) => item.id === assignment?.sponsorId,
    );
    const publication = input.publications.find(
      (item) => item.id === lead.funnelPublicationId,
    );
    const funnel = input.funnels.find(
      (item) => item.id === lead.funnelInstanceId,
    );
    const team =
      input.teams.find((item) => item.id === assignment?.teamId) ??
      input.teams.find((item) => item.id === funnel?.teamId) ??
      input.teams.find((item) => item.id === publication?.teamId);

    return {
      ...lead,
      sponsorName: sponsor?.displayName ?? null,
      sponsorId: sponsor?.id ?? null,
      assignmentStatus: assignment?.status ?? null,
      assignedAt: assignment?.assignedAt ?? null,
      publicationPath: publication?.pathPrefix ?? null,
      domainHost: publication?.domainHost ?? null,
      funnelName: funnel?.name ?? publication?.funnelName ?? null,
      funnelCode: funnel?.code ?? publication?.funnelCode ?? null,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
    };
  });
};

const buildMockRotationPoolMembers = (input: {
  rotationPools: RotationPoolRecord[];
  sponsors: SponsorRecord[];
}): RotationPoolMemberRecord[] => {
  return input.rotationPools.flatMap((pool) =>
    pool.sponsorIds.map((sponsorId, index) => {
      const sponsor = input.sponsors.find((item) => item.id === sponsorId);

      return {
        id: `${pool.id}:${sponsorId}`,
        rotationPoolId: pool.id,
        poolName: pool.name,
        sponsorId,
        sponsorName: sponsor?.displayName ?? "Sponsor pendiente",
        sponsorStatus: sponsor?.status ?? "draft",
        sponsorAvailabilityStatus: sponsor?.availabilityStatus ?? "paused",
        position: index + 1,
        weight: 1,
        isActive: true,
        createdAt: pool.createdAt,
        updatedAt: pool.updatedAt,
      };
    }),
  );
};

const buildLeadRemindersSummary = (
  leads: LeadRecord[],
): LeadRemindersSummary => {
  return leads.reduce<LeadRemindersSummary>(
    (summary, lead) => {
      if (lead.reminderBucket === "none") {
        return summary;
      }

      summary.totals.active += 1;

      if (lead.needsAttention) {
        summary.totals.needsAttention += 1;
      }

      switch (lead.reminderBucket) {
        case "overdue":
          summary.totals.overdue += 1;
          break;
        case "due_today":
          summary.totals.dueToday += 1;
          break;
        case "upcoming":
          summary.totals.upcoming += 1;
          break;
        case "unscheduled":
          summary.totals.unscheduled += 1;
          break;
        default:
          break;
      }

      return summary;
    },
    {
      generatedAt: new Date().toISOString(),
      totals: {
        active: 0,
        overdue: 0,
        dueToday: 0,
        upcoming: 0,
        unscheduled: 0,
        needsAttention: 0,
      },
    },
  );
};

export const getAppShellSnapshot = async (): Promise<AppShellSnapshot> => {
  noStore();
  const currentUser =
    (await getSessionUser()) as AuthenticatedAppUserRecord | null;
  const remindersFallback = buildLeadRemindersSummary(mockLeads);

  const canReadAdminCollections =
    currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "TEAM_ADMIN";
  const memberSponsorFallback =
    currentUser?.sponsorId && currentUser.sponsor
      ? {
          ...mockSponsors[0],
          id: currentUser.sponsor.id,
          workspaceId: currentUser.workspaceId ?? mockWorkspace.id,
          teamId: currentUser.teamId ?? mockTeamMetadata[0].id,
          displayName: currentUser.sponsor.displayName,
          isActive: currentUser.sponsor.isActive,
          avatarUrl: null,
          email: currentUser.sponsor.email,
          availabilityStatus: currentUser.sponsor.availabilityStatus,
        }
      : mockSponsors[0];

  const [
    workspacesResult,
    teamsResult,
    templatesResult,
    funnelInstancesResult,
    publicationsResult,
    domainsResult,
    sponsorsResult,
    rotationPoolsResult,
    rotationPoolMembersResult,
    trackingProfilesResult,
    handoffStrategiesResult,
    leadsResult,
    assignmentsResult,
    remindersSummaryResult,
  ] = await Promise.all([
    currentUser?.role === "SUPER_ADMIN"
      ? fetchCollection<WorkspaceRecord>("/workspaces", [mockWorkspace])
      : Promise.resolve({
          data: currentUser?.workspace
            ? [
                {
                  ...mockWorkspace,
                  id: currentUser.workspace.id,
                  name: currentUser.workspace.name,
                  slug: currentUser.workspace.slug,
                  primaryDomain: currentUser.workspace.primaryDomain,
                },
              ]
            : [mockWorkspace],
          source: "live" as const,
        }),
    canReadAdminCollections
      ? fetchCollection<TeamMetadata>("/teams", mockTeamMetadata)
      : Promise.resolve({
          data:
            currentUser?.teamId && currentUser.team
              ? [
                  {
                    id: currentUser.team.id,
                    workspaceId: currentUser.workspaceId ?? mockWorkspace.id,
                    name: currentUser.team.name,
                    code: currentUser.team.code,
                    status: "active",
                    description:
                      "Team resuelto desde la sesión autenticada del usuario.",
                    maxSeats: mockTeamMetadata[0].maxSeats,
                  },
                ]
              : mockTeamMetadata,
          source: "live" as const,
        }),
    canReadAdminCollections
      ? fetchCollection<FunnelTemplateRecord>(
          "/funnel-templates",
          mockTemplates,
        )
      : Promise.resolve({
          data: mockTemplates,
          source: "mock" as const,
        }),
    canReadAdminCollections
      ? fetchCollection<FunnelInstanceRecord>(
          "/funnel-instances",
          mockFunnelInstances,
        )
      : Promise.resolve({
          data: mockFunnelInstances,
          source: "mock" as const,
        }),
    canReadAdminCollections
      ? fetchCollection<FunnelPublicationRecord>(
          "/funnel-publications",
          mockPublications,
        )
      : Promise.resolve({
          data: mockPublications,
          source: "mock" as const,
        }),
    canReadAdminCollections
      ? fetchCollection<DomainRecord>("/domains", mockDomains)
      : Promise.resolve({
          data: mockDomains,
          source: "mock" as const,
        }),
    currentUser?.role === "MEMBER"
      ? fetchSingleton<SponsorRecord>(
          "/sponsors/me",
          memberSponsorFallback,
        ).then((result) => ({
          data: [result.data],
          source: result.source,
        }))
      : canReadAdminCollections
        ? fetchCollection<SponsorRecord>("/sponsors", mockSponsors)
        : Promise.resolve({
            data: mockSponsors,
            source: "mock" as const,
          }),
    canReadAdminCollections
      ? fetchCollection<RotationPoolRecord>(
          "/rotation-pools",
          mockRotationPools,
        )
      : Promise.resolve({
          data: mockRotationPools,
          source: "mock" as const,
        }),
    canReadAdminCollections
      ? fetchCollection<RotationPoolMemberRecord>(
          "/rotation-pools/members",
          buildMockRotationPoolMembers({
            rotationPools: mockRotationPools,
            sponsors: mockSponsors,
          }),
        )
      : Promise.resolve({
          data: [],
          source: "mock" as const,
        }),
    canReadAdminCollections
      ? fetchCollection<TrackingProfileRecord>("/tracking-profiles", [])
      : Promise.resolve({
          data: [],
          source: "mock" as const,
        }),
    canReadAdminCollections
      ? fetchCollection<HandoffStrategyRecord>("/handoff-strategies", [])
      : Promise.resolve({
          data: [],
          source: "mock" as const,
        }),
    fetchCollection<LeadRecord>("/leads", mockLeads),
    fetchCollection<AssignmentRecord>("/assignments", mockAssignments),
    fetchSingleton<LeadRemindersSummary>(
      "/leads/reminders/summary",
      remindersFallback,
    ),
  ]);

  const sources = {
    workspaces: workspacesResult.source,
    teams: teamsResult.source,
    templates: templatesResult.source,
    funnelInstances: funnelInstancesResult.source,
    publications: publicationsResult.source,
    domains: domainsResult.source,
    sponsors: sponsorsResult.source,
    rotationPools: rotationPoolsResult.source,
    rotationPoolMembers: rotationPoolMembersResult.source,
    trackingProfiles: trackingProfilesResult.source,
    handoffStrategies: handoffStrategiesResult.source,
    leads: leadsResult.source,
    assignments: assignmentsResult.source,
    remindersSummary: remindersSummaryResult.source,
  };

  const workspace = workspacesResult.data[0] ?? mockWorkspace;
  const derivedTeams = buildDerivedTeams({
    workspace,
    funnelInstances: funnelInstancesResult.data,
    publications: publicationsResult.data,
    domains: domainsResult.data,
    sponsors: sponsorsResult.data,
    rotationPools: rotationPoolsResult.data,
    leads: leadsResult.data,
    assignments: assignmentsResult.data,
  }).map((team) => {
    const liveTeam = teamsResult.data.find((item) => item.id === team.id);

    return {
      ...team,
      name: liveTeam?.name ?? team.name,
      code: liveTeam?.code ?? team.code,
      status: liveTeam?.status ?? team.status,
      description: liveTeam?.description ?? team.description,
      maxSeats: liveTeam?.maxSeats ?? team.maxSeats,
    };
  });
  const publicationViews = buildPublicationViews({
    publications: publicationsResult.data,
    domains: domainsResult.data,
    funnelInstances: funnelInstancesResult.data,
    templates: templatesResult.data,
    teams: derivedTeams,
  });
  const funnelViews = buildFunnelViews({
    funnelInstances: funnelInstancesResult.data,
    templates: templatesResult.data,
    teams: derivedTeams,
    publications: publicationsResult.data,
  });
  const leadViews = buildLeadViews({
    leads: leadsResult.data,
    assignments: assignmentsResult.data,
    sponsors: sponsorsResult.data,
    publications: publicationViews,
    funnels: funnelViews,
    teams: derivedTeams,
  });

  const currentTeam = (currentUser?.teamId
    ? derivedTeams.find((item) => item.id === currentUser.teamId)
    : null) ??
    derivedTeams[0] ?? {
      ...mockTeamMetadata[0],
      sponsorCount: mockSponsors.length,
      funnelCount: mockFunnelInstances.length,
      publicationCount: mockPublications.length,
      domainCount: mockDomains.length,
      poolCount: mockRotationPools.length,
      leadCount: mockLeads.length,
      assignmentCount: mockAssignments.length,
    };

  const currentSponsor =
    (currentUser?.sponsorId
      ? sponsorsResult.data.find((item) => item.id === currentUser.sponsorId)
      : null) ??
    sponsorsResult.data.find((item) => item.id === defaultSponsorId) ??
    sponsorsResult.data.find((item) => item.memberPortalEnabled) ??
    sponsorsResult.data[0] ??
    mockSponsors[0];

  return {
    currentUser,
    sourceMode: resolveSourceMode(sources),
    sources,
    workspaces: workspacesResult.data,
    workspace,
    teams: derivedTeams,
    currentTeam,
    templates: templatesResult.data,
    funnelInstances: funnelInstancesResult.data,
    funnelViews,
    publications: publicationsResult.data,
    publicationViews,
    domains: domainsResult.data,
    sponsors: sponsorsResult.data,
    currentSponsor,
    rotationPools: rotationPoolsResult.data,
    rotationPoolMembers: rotationPoolMembersResult.data,
    trackingProfiles: trackingProfilesResult.data,
    handoffStrategies: handoffStrategiesResult.data,
    leads: leadsResult.data,
    leadViews,
    assignments: assignmentsResult.data,
    events: mockEvents,
    memberProfile: mockMemberProfile,
    remindersSummary: remindersSummaryResult.data,
  };
};
