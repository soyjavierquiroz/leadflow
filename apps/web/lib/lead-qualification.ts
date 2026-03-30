"use client";

import { webPublicConfig } from "@/lib/public-env";

type ErrorPayload = {
  message?: string;
  error?: string;
};

export type LeadQualificationGrade = "cold" | "warm" | "hot";

export type LeadTimelineNote = {
  id: string;
  body: string;
  authorName: string;
  authorRole: "SUPER_ADMIN" | "TEAM_ADMIN" | "MEMBER";
  sponsorId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadTimelineItem =
  | {
      id: string;
      itemType: "note";
      occurredAt: string;
      title: string;
      description: string;
      actorLabel: string;
      statusLabel: string | null;
    }
  | {
      id: string;
      itemType: "event";
      occurredAt: string;
      title: string;
      description: string;
      actorLabel: string;
      statusLabel: string | null;
      eventName: string;
    };

export type LeadTimelineDetail = {
  lead: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    sourceChannel: string;
    status: string;
    qualificationGrade: LeadQualificationGrade | null;
    summaryText: string | null;
    nextActionLabel: string | null;
    followUpAt: string | null;
    lastContactedAt: string | null;
    lastQualifiedAt: string | null;
    sponsorId: string | null;
    sponsorName: string | null;
    teamId: string | null;
    teamName: string | null;
    assignmentId: string | null;
    assignmentStatus: string | null;
    assignedAt: string | null;
    funnelName: string | null;
    domainHost: string | null;
    publicationPath: string | null;
    createdAt: string;
    updatedAt: string;
  };
  workflow: {
    reminder: {
      bucket: "overdue" | "due_today" | "upcoming" | "unscheduled" | "none";
      label: string;
      followUpAt: string | null;
      needsAttention: boolean;
      isOverdue: boolean;
      isDueToday: boolean;
      isUpcoming: boolean;
      needsScheduling: boolean;
    };
    suggestedNextAction: string;
    effectiveNextAction: string;
    playbook: {
      key:
        | "first_contact"
        | "active_nurture"
        | "high_intent_close"
        | "cold_reengage"
        | "won_handoff"
        | "lost_recycle";
      title: string;
      description: string;
      checklist: string[];
      suggestedNextAction: string;
    };
  };
  notes: LeadTimelineNote[];
  timeline: LeadTimelineItem[];
};

type LeadMutationResponse = {
  id: string;
  qualificationGrade: LeadQualificationGrade | null;
  summaryText: string | null;
  nextActionLabel: string | null;
  followUpAt: string | null;
  lastContactedAt: string | null;
  lastQualifiedAt: string | null;
  status: string;
  updatedAt: string;
};

const leadQualificationRequest = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${webPublicConfig.urls.api}/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const errorPayload = payload as ErrorPayload;
    const message =
      (typeof errorPayload.message === "string"
        ? errorPayload.message
        : null) ??
      (typeof errorPayload.error === "string" ? errorPayload.error : null) ??
      "No pudimos completar la operación sobre el lead.";

    throw new Error(message);
  }

  return payload as T;
};

export const getLeadTimelineDetail = async (leadId: string) =>
  leadQualificationRequest<LeadTimelineDetail>(`/leads/${leadId}/timeline`);

export const updateLeadQualification = async (
  leadId: string,
  payload: {
    qualificationGrade?: LeadQualificationGrade | null;
    summaryText?: string | null;
  },
) =>
  leadQualificationRequest<LeadMutationResponse>(
    `/leads/${leadId}/qualification`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );

export const updateLeadFollowUp = async (
  leadId: string,
  payload: {
    nextActionLabel?: string | null;
    followUpAt?: string | null;
  },
) =>
  leadQualificationRequest<LeadMutationResponse>(`/leads/${leadId}/follow-up`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const createLeadNote = async (
  leadId: string,
  payload: { body: string },
) =>
  leadQualificationRequest<LeadTimelineNote>(`/leads/${leadId}/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
