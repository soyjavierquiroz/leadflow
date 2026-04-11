"use client";

import type { ReactNode } from "react";

import { LeadCaptureProvider } from "@/components/public-funnel/lead-capture-context";
import { PublicLeadCaptureModalHost } from "@/components/public-funnel/public-lead-capture-modal-host";
import type {
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

type PublicLeadCaptureRuntimeBoundaryProps = {
  children: ReactNode;
  runtime: PublicFunnelRuntimePayload;
  blocks: RuntimeBlock[];
};

export function PublicLeadCaptureRuntimeBoundary({
  children,
  runtime,
  blocks,
}: PublicLeadCaptureRuntimeBoundaryProps) {
  return (
    <LeadCaptureProvider>
      {children}
      <PublicLeadCaptureModalHost runtime={runtime} blocks={blocks} />
    </LeadCaptureProvider>
  );
}
