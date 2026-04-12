"use client";

import { useEffect, useState } from "react";

import { LeadCaptureModal } from "@/components/public-funnel/lead-capture-modal";
import { useLeadCaptureModal } from "@/components/public-funnel/lead-capture-context";
import { resolveLeadCaptureModalConfig } from "@/components/public-funnel/lead-capture-modal-config";
import {
  normalizeLeadCaptureFormBlock,
  normalizeRuntimeBlockType,
} from "@/components/public-funnel/runtime-block-utils";
import type {
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

type PublicLeadCaptureModalHostProps = {
  runtime: PublicFunnelRuntimePayload;
  blocks: RuntimeBlock[];
};

export function PublicLeadCaptureModalHost({
  runtime,
  blocks,
}: PublicLeadCaptureModalHostProps) {
  const leadCapture = useLeadCaptureModal();
  const [isNativeOpen, setIsNativeOpen] = useState(false);
  const isOpen = isNativeOpen || leadCapture?.isOpen || false;
  const openModal = leadCapture?.openModal;
  const closeModal = leadCapture?.closeModal;
  const leadCaptureConfigBlock =
    blocks.find(
      (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_config",
    ) ?? null;
  const leadCaptureFormBlock =
    blocks.find(
      (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_form",
    ) ?? null;
  const normalizedLeadCaptureFormBlock = leadCaptureFormBlock
    ? normalizeLeadCaptureFormBlock(leadCaptureFormBlock)
    : null;
  const modalConfig = resolveLeadCaptureModalConfig(leadCaptureConfigBlock);

  useEffect(() => {
    const handleOpen = () => {
      setIsNativeOpen(true);
    };

    window.addEventListener("leadflow:open_modal", handleOpen);
    return () => window.removeEventListener("leadflow:open_modal", handleOpen);
  }, []);

  if (!modalConfig) {
    return null;
  }

  return (
    <>
      <LeadCaptureModal
        publicationId={runtime.publication.id}
        currentStepId={runtime.currentStep.id}
        triggerLabel={modalConfig.ctaText}
        triggerClassName="sr-only"
        triggerAction="open_lead_capture_modal"
        modalConfig={modalConfig}
        runtime={runtime}
        sourceChannel={normalizedLeadCaptureFormBlock?.settings.sourceChannel}
        tags={normalizedLeadCaptureFormBlock?.settings.tags}
        renderTrigger={false}
        open={isOpen}
        onOpenChange={(nextOpen) => {
          setIsNativeOpen(nextOpen);

          if (nextOpen) {
            openModal?.();
            return;
          }

          closeModal?.();
        }}
      />
    </>
  );
}
