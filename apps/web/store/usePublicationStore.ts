"use client";

import { create } from "zustand";

export type PublicationRuntimeHealthStatus = "healthy" | "warning" | "broken";

export type PublicationLintIssueSeverity = "info" | "warning" | "error";

export type PublicationLintIssue = {
  code: string;
  severity: PublicationLintIssueSeverity;
  message: string;
  blockKey?: string;
  blockIndex?: number;
  autofixAvailable?: boolean;
};

type PublicationStoreState = {
  publicationId: string | null;
  blocksText: string;
  runtimeHealthStatus: PublicationRuntimeHealthStatus;
  lintIssues: PublicationLintIssue[];
  setPublicationId: (publicationId: string | null) => void;
  setBlocksText: (blocksText: string) => void;
  setRuntimeHealthStatus: (status: PublicationRuntimeHealthStatus) => void;
  setLintIssues: (issues: PublicationLintIssue[]) => void;
  hydrateDraft: (draft: {
    publicationId: string | null;
    blocksText: string;
    runtimeHealthStatus?: PublicationRuntimeHealthStatus;
    lintIssues?: PublicationLintIssue[];
  }) => void;
};

export const usePublicationStore = create<PublicationStoreState>((set) => ({
  publicationId: null,
  blocksText: "",
  runtimeHealthStatus: "warning",
  lintIssues: [],
  setPublicationId: (publicationId) => set({ publicationId }),
  setBlocksText: (blocksText) => set({ blocksText }),
  setRuntimeHealthStatus: (runtimeHealthStatus) =>
    set({ runtimeHealthStatus }),
  setLintIssues: (lintIssues) => set({ lintIssues }),
  hydrateDraft: (draft) =>
    set((state) => ({
      publicationId: draft.publicationId,
      blocksText: draft.blocksText,
      runtimeHealthStatus:
        draft.runtimeHealthStatus ?? state.runtimeHealthStatus,
      lintIssues: draft.lintIssues ?? state.lintIssues,
    })),
}));
