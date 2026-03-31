import { apiFetchWithSession } from "@/lib/auth";

export type MemberDashboardAvailabilityStatus =
  | "available"
  | "paused"
  | "offline";

export type MemberDashboardLeadStatus =
  | "captured"
  | "qualified"
  | "assigned"
  | "nurturing"
  | "won"
  | "lost";

export type MemberDashboardAssignmentStatus = "assigned" | "accepted";

export type MemberDashboardReminderBucket =
  | "overdue"
  | "due_today"
  | "upcoming"
  | "unscheduled"
  | "none";

export type MemberDashboardSponsor = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  availabilityStatus: MemberDashboardAvailabilityStatus;
};

export type MemberDashboardKpis = {
  handoffsNew: number;
  actionsToday: number;
  activePortfolio: number;
};

export type MemberDashboardLead = {
  id: string;
  assignmentId: string;
  leadName: string;
  companyName: string | null;
  contactLabel: string;
  leadStatus: MemberDashboardLeadStatus;
  assignmentStatus: MemberDashboardAssignmentStatus;
  reminderBucket: MemberDashboardReminderBucket;
  reminderLabel: string;
  needsAttention: boolean;
  nextActionLabel: string;
  assignedAt: string;
  followUpAt: string | null;
  publicationPath: string | null;
  domainHost: string | null;
  funnelName: string | null;
};

export type MemberDashboardSnapshot = {
  sponsor: MemberDashboardSponsor;
  kpis: MemberDashboardKpis;
  inbox: MemberDashboardLead[];
};

const getErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ??
  "No pudimos cargar tu jornada comercial.";

export const getMemberDashboardSnapshot =
  async (): Promise<MemberDashboardSnapshot> => {
    const response = await apiFetchWithSession("/sponsors/me/dashboard");
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(getErrorMessage(payload));
    }

    return payload as MemberDashboardSnapshot;
  };
