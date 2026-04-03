"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  submitRuntimeLeadCapture,
  type LeadCaptureSubmissionPayload,
  type LeadCaptureSubmissionResponse,
} from "@/lib/public-funnel-session";

type PublicRuntimeLeadSubmitContextValue = {
  submitLeadCapture: (
    payload: LeadCaptureSubmissionPayload,
  ) => Promise<LeadCaptureSubmissionResponse>;
};

const PublicRuntimeLeadSubmitContext =
  createContext<PublicRuntimeLeadSubmitContextValue | null>(null);

type PublicRuntimeLeadSubmitProviderProps = {
  hostname: string;
  path: string;
  children: ReactNode;
};

export function PublicRuntimeLeadSubmitProvider({
  hostname,
  path,
  children,
}: PublicRuntimeLeadSubmitProviderProps) {
  const value = useMemo<PublicRuntimeLeadSubmitContextValue>(
    () => ({
      submitLeadCapture: (payload) =>
        submitRuntimeLeadCapture({
          hostname,
          path,
          payload,
        }),
    }),
    [hostname, path],
  );

  return (
    <PublicRuntimeLeadSubmitContext.Provider value={value}>
      {children}
    </PublicRuntimeLeadSubmitContext.Provider>
  );
}

export const usePublicRuntimeLeadSubmit = () =>
  useContext(PublicRuntimeLeadSubmitContext);
