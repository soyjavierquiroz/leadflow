import { BadRequestException } from '@nestjs/common';
import type { JsonValue } from './domain.types';

const supportedFunnelBlockTypes = [
  'announcement',
  'hero',
  'hook_and_promise',
  'who_am_i',
  'qualification_checklist',
  'lead_capture_config',
  'lead_capture_form',
  'unique_mechanism',
  'urgency_timer',
  'text',
  'video',
  'video_player',
  'cta',
  'faq',
  'faq_accordion',
  'faq_social_proof',
  'thank_you',
  'thank_you_reveal',
  'conversion_page_config',
  'sponsor_reveal_placeholder',
  'social_proof',
  'social_proof_grid',
  'risk_reversal',
  'testimonials',
  'feature_grid',
  'media',
  'image',
  'offer_pricing',
  'grand_slam_offer',
  'whatsapp_handoff_cta',
  'step_by_step',
  'paradigm_shift',
  'sticky_conversion_bar',
  // Legacy aliases normalized by the public runtime.
  'form_placeholder',
  'hero_block',
  'video_block',
  'features',
  'features_and_benefits',
  'how_it_works',
  'offer',
  'pricing',
  'offer_stack',
  'final_cta',
  'testimonial',
  'marquee',
] as const;

export type SupportedFunnelBlockType = (typeof supportedFunnelBlockTypes)[number];

const supportedFunnelBlockTypeSet = new Set<string>(supportedFunnelBlockTypes);

const isJsonRecord = (
  value: JsonValue | null | undefined,
): value is Record<string, JsonValue> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const isSupportedFunnelBlockType = (
  value: unknown,
): value is SupportedFunnelBlockType =>
  typeof value === 'string' && supportedFunnelBlockTypeSet.has(value);

export const assertSupportedFunnelBlocksJson = (
  value: JsonValue,
  input: {
    invalidArrayCode: string;
    invalidArrayMessage: string;
    invalidBlockCode: string;
    field?: string;
  },
) => {
  if (!Array.isArray(value)) {
    throw new BadRequestException({
      code: input.invalidArrayCode,
      message: input.invalidArrayMessage,
      field: input.field,
    });
  }

  value.forEach((entry, index) => {
    const blockRecord = isJsonRecord(entry) ? entry : null;
    const blockType = blockRecord?.type;

    if (!isSupportedFunnelBlockType(blockType)) {
      throw new BadRequestException({
        code: input.invalidBlockCode,
        message: `Unsupported block type at index ${index}: ${String(
          blockType ?? '[missing]',
        )}.`,
        field: input.field,
      });
    }
  });

  return value;
};
