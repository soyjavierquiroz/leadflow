import { PublicRuntimeLeadSubmitProvider } from "@/components/public-runtime/public-runtime-lead-submit-provider";
import { FunnelThemeProvider } from "@/components/public-funnel/FunnelThemeProvider";
import {
  isCenteredPublicStepLayout,
  resolvePublicStepLayout,
} from "@/components/public-funnel/runtime-layout";
import {
  normalizeRuntimeBlockType,
  parseRuntimeBlocks,
} from "@/components/public-funnel/runtime-block-utils";
import { StickyMediaGallery } from "@/components/public-funnel/sticky-media-gallery";
import { SplitMediaFocusLayout } from "@/components/structures/SplitMediaFocusLayout";
import { BlockRegistry } from "@/lib/blocks/registry";
import { resolveFunnelThemeId } from "@/lib/funnel-theme-registry";
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
  themeId?: string;
  settingsJson?: JsonValue;
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
  themeId = "default",
  settingsJson: JsonValue = {},
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
    settingsJson,
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
    entryContext: {
      entryMode: "paid_ads",
      trafficLayer: "ORGANIC",
      forcedSponsorId: null,
      adWheelId: null,
      browserPixelsEnabled: true,
      attributionType: "organic",
      attributionSlug: null,
      runtimePathPrefix: null,
      referralQueryParam: null,
    },
    publication: {
      id: "preview-publication",
      pathPrefix: previewPath,
      isPrimary: true,
      trackingProfileId: null,
      handoffStrategyId: null,
      metaPixelId: null,
      tiktokPixelId: null,
      seoTitle: null,
      seoDescription: null,
      ogImageUrl: null,
      faviconUrl: null,
      nextStepPath: `${previewPath}/next`,
      manifestVersion: 1,
      runtimeHealthStatus: "healthy",
    },
    theme: resolveFunnelThemeId(themeId),
    funnel: {
      id: "preview-funnel",
      name: "Preview Funnel",
      code: "preview-funnel",
      status: "draft",
      structuralType: "two_step_conversion",
      conversionContract: {
        transitions: {
          preview: {
            default: `${previewPath}/next`,
          },
        },
      },
      settingsJson,
      mediaMap,
      template: {
        id: resolvedTemplateId,
        code: resolvedTemplateCode,
        name: resolvedTemplateName,
        version: 1,
        funnelType: "hybrid",
        blocksJson: blocks as JsonValue,
        mediaMap,
        settingsJson,
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
      sponsor: null,
      whatsappPhone: null,
      whatsappMessage: null,
      whatsappUrl: null,
    },
    leadId: null,
    assignment: null,
    advisor: null,
    assignedSponsor: null,
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
  themeId = "default",
  settingsJson = {},
  template,
}: BlockRendererProps) {
  const parsedBlocks = parseRuntimeBlocks(blocks as JsonValue[]).blocks;
  const runtime = buildPreviewRuntime(
    parsedBlocks,
    mediaMap,
    themeId,
    settingsJson,
    template,
  );
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
      type !== "lead_capture_config" &&
      !block.is_hidden &&
      !block.hidden &&
      !block.isHidden
    );
  });
  const stepLayout = resolvePublicStepLayout({
    blocks: visibleBlocks,
    settingsJson: runtime.currentStep.settingsJson,
    funnelSettingsJson: runtime.funnel.settingsJson,
  });
  const isSingleColumnLayout = stepLayout === "single_column";
  const isBlankLayout = stepLayout === "blank";
  const isCenteredLayout = isCenteredPublicStepLayout({
    settingsJson: runtime.currentStep.settingsJson,
  });
  const unsupportedBlocks = parsedBlocks
    .map((block, index) => ({
      block,
      index,
      normalizedType: normalizeRuntimeBlockType(block.type),
    }))
    .filter(({ normalizedType }) => !BlockRegistry[normalizedType]);

  const renderBlock = (block: RuntimeBlock, index: number) => {
    const { type, ...props } = block;
    const normalizedType = normalizeRuntimeBlockType(type);

    console.log("Rendering block:", normalizedType, {
      originalType: type,
      blockId: block.block_id ?? block.key ?? `${type}-${index}`,
    });

    if (normalizedType === "mobile_gallery") {
      return (
        <div
          key={`${type}-${index}`}
          className="block w-full py-6 lg:hidden"
        >
          <StickyMediaGallery
            runtime={runtime}
            blocks={parsedBlocks}
            inFlow={true}
          />
        </div>
      );
    }

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
    <PublicRuntimeLeadSubmitProvider
      hostname={previewHost}
      path={previewPath}
      runtime={runtime}
    >
      <FunnelThemeProvider runtime={runtime}>
        <div className="pb-12">
          {unsupportedBlocks.length > 0 ? (
            <div className="pointer-events-none fixed right-4 top-4 z-[120] flex max-w-sm flex-col gap-3">
              {unsupportedBlocks.map(({ block, index }) => (
                <div
                  key={`unsupported-${block.block_id ?? block.key ?? block.type}-${index}`}
                  className="rounded-2xl border border-red-300 bg-red-50/95 px-4 py-3 text-sm font-medium text-red-700 shadow-2xl shadow-red-900/10 backdrop-blur"
                >
                  Unsupported block: {block.type}
                </div>
              ))}
            </div>
          ) : null}
          {isBlankLayout ? (
            <div>{visibleBlocks.map((block, index) => renderBlock(block, index))}</div>
          ) : isSingleColumnLayout ? (
            <>
              {announcementBlock ? renderBlock(announcementBlock, -1) : null}
              <div
                className={
                  isCenteredLayout
                    ? "flex min-h-screen w-full flex-col px-4 py-0 md:px-6 md:py-0"
                    : "px-4 py-6 md:px-6 md:py-10"
                }
              >
                {visibleBlocks.map((block, index) => renderBlock(block, index))}
              </div>
            </>
          ) : (
            <SplitMediaFocusLayout
              runtime={runtime}
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
      </FunnelThemeProvider>
    </PublicRuntimeLeadSubmitProvider>
  );
}
