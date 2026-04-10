import { PublicRuntimeLeadSubmitProvider } from "@/components/public-runtime/public-runtime-lead-submit-provider";
import { resolvePublicStepLayout } from "@/components/public-funnel/runtime-layout";
import {
  normalizeRuntimeBlockType,
  parseRuntimeBlocks,
} from "@/components/public-funnel/runtime-block-utils";
import { StickyMediaGallery } from "@/components/public-funnel/sticky-media-gallery";
import { SplitMediaFocusLayout } from "@/components/structures/SplitMediaFocusLayout";
import { BlockRegistry } from "@/lib/blocks/registry";
import type {
  JsonValue,
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

export type BlockDefinition = {
  type: string;
  [key: string]: any;
};

type BlockRendererProps = {
  blocks: BlockDefinition[];
  mediaMap?: Record<string, string>;
  template?: {
    id: string;
    code?: string;
    name?: string;
  };
};

const previewHost = "preview.leadflow.local";
const previewPath = "/preview";

function inferPreviewStepType(blocks: RuntimeBlock[]) {
  const hasCaptureBlock = blocks.some((block) => {
    const normalizedType = normalizeRuntimeBlockType(block.type);
    return (
      normalizedType === "lead_capture_form" ||
      normalizedType === "lead_capture_config"
    );
  });

  return hasCaptureBlock ? "capture_step" : "landing_page";
}

function buildPreviewRuntime(
  blocks: RuntimeBlock[],
  mediaMap: Record<string, string>,
  template?: BlockRendererProps["template"],
): PublicFunnelRuntimePayload {
  const stepType = inferPreviewStepType(blocks);
  const resolvedTemplateId = template?.id?.trim() || "preview-template";
  const resolvedTemplateCode = template?.code?.trim() || resolvedTemplateId;
  const resolvedTemplateName =
    template?.name?.trim() || "Preview Template";
  const currentStep = {
    id: "preview-step",
    slug: "preview",
    path: previewPath,
    stepType,
    position: 1,
    isEntryStep: true,
    isConversionStep: stepType === "capture_step",
    blocksJson: blocks as JsonValue,
    mediaMap,
    settingsJson: {},
  };

  return {
    request: {
      host: previewHost,
      path: previewPath,
      publicationPathPrefix: previewPath,
      relativeStepPath: previewPath,
    },
    domain: {
      id: "preview-domain",
      host: previewHost,
      normalizedHost: previewHost,
      domainType: "preview",
      isPrimary: true,
      canonicalHost: null,
      redirectToPrimary: false,
    },
    publication: {
      id: "preview-publication",
      pathPrefix: previewPath,
      isPrimary: true,
      trackingProfileId: null,
      handoffStrategyId: null,
    },
    funnel: {
      id: "preview-funnel",
      name: "Preview Funnel",
      code: "preview-funnel",
      status: "draft",
      settingsJson: {},
      mediaMap,
      template: {
        id: resolvedTemplateId,
        code: resolvedTemplateCode,
        name: resolvedTemplateName,
        version: 1,
        funnelType: "hybrid",
        blocksJson: blocks as JsonValue,
        mediaMap,
        settingsJson: {},
        allowedOverridesJson: {},
      },
    },
    trackingProfile: null,
    handoffStrategy: null,
    handoff: {
      mode: null,
      channel: null,
      buttonLabel: "Preview no interactivo",
      autoRedirect: false,
      autoRedirectDelayMs: null,
      messageTemplate: null,
    },
    currentStep,
    nextStep: {
      id: "preview-next-step",
      slug: "preview-next",
      path: `${previewPath}/next`,
      stepType: "thank_you_step",
    },
    previousStep: null,
    steps: [currentStep],
  };
}

export function BlockRenderer({
  blocks,
  mediaMap = {},
  template,
}: BlockRendererProps) {
  const parsedBlocks = parseRuntimeBlocks(blocks as JsonValue[]).blocks;
  const runtime = buildPreviewRuntime(parsedBlocks, mediaMap, template);
  const announcementBlock =
    parsedBlocks.find((block) => {
      const type = normalizeRuntimeBlockType(block.type);
      return type === "announcement" || type === "marquee";
    }) ?? null;
  const modalConfigBlock =
    parsedBlocks.find(
      (block) => normalizeRuntimeBlockType(block.type) === "lead_capture_config",
    ) ?? null;
  const visibleBlocks = parsedBlocks.filter((block) => {
    const type = normalizeRuntimeBlockType(block.type);
    return (
      type !== "announcement" &&
      type !== "marquee" &&
      type !== "lead_capture_config"
    );
  });
  const stepLayout = resolvePublicStepLayout({
    blocks: visibleBlocks,
    settingsJson: runtime.currentStep.settingsJson,
  });
  const isSingleColumnLayout = stepLayout === "single_column";

  const renderBlock = (block: RuntimeBlock, index: number) => {
    const { type, ...props } = block;
    const normalizedType = normalizeRuntimeBlockType(type);
    const BlockComponent = BlockRegistry[normalizedType];

    if (!BlockComponent) {
      return (
        <div
          key={`${type}-${index}`}
          className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-medium text-red-700"
        >
          Bloque no encontrado: {type}
        </div>
      );
    }

    return (
      <BlockComponent
        key={`${type}-${index}`}
        {...props}
        block={block}
        blocks={parsedBlocks}
        runtime={runtime}
      />
    );
  };

  return (
    <PublicRuntimeLeadSubmitProvider hostname={previewHost} path={previewPath}>
      <div className="pb-12">
        {isSingleColumnLayout ? (
          <>
            {announcementBlock ? renderBlock(announcementBlock, -1) : null}
            <div className="bg-white px-4 py-6 md:px-6 md:py-10">
              {visibleBlocks.map((block, index) => renderBlock(block, index))}
            </div>
          </>
        ) : (
          <SplitMediaFocusLayout
            announcementSlot={
              announcementBlock ? renderBlock(announcementBlock, -1) : null
            }
            mediaSlot={
              <StickyMediaGallery
                runtime={runtime}
                blocks={parsedBlocks}
                className="h-full"
              />
            }
            contentSlot={visibleBlocks.map((block, index) => renderBlock(block, index))}
          />
        )}
        {/* El modal se resuelve desde los CTAs reales, no como caja inline. */}
        {modalConfigBlock ? renderBlock(modalConfigBlock, -2) : null}
      </div>
    </PublicRuntimeLeadSubmitProvider>
  );
}
