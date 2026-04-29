import {
  blockHasAction,
  hasLeadCaptureConfig,
  parseBlocksArray,
} from "../block-utils";
import { OPEN_LEAD_CAPTURE_MODAL } from "../rules/cta-modal-wiring.rule";
import type { FunnelBlock, JsonValue } from "../types";

export const buildDefaultLeadCaptureConfigBlock = (): FunnelBlock => ({
  type: "lead_capture_config",
  key: "self-healed-lead-capture-config",
  modal_config: {
    title: "Estas a un paso",
    description: "Completa tus datos para continuar con la siguiente etapa.",
    default_country: "BO",
    fields: {
      name: {
        label: "Nombre",
        placeholder: "Tu nombre completo",
        error_msg: "Ingresa tu nombre para continuar.",
      },
      phone: {
        label: "WhatsApp",
        placeholder: "Tu numero de WhatsApp",
        error_msg: "Ingresa un numero valido.",
      },
    },
    cta_button: {
      text: "Quiero continuar",
      subtext: "Respuesta prioritaria por WhatsApp.",
    },
  },
  success_redirect: "/confirmado",
  self_healed: true,
});

export const healLeadCaptureConfig = (blocksJson: JsonValue) => {
  const blocks = parseBlocksArray(blocksJson);
  const hasCaptureAction = blocks.some((block) =>
    blockHasAction(block, OPEN_LEAD_CAPTURE_MODAL),
  );

  if (!hasCaptureAction || hasLeadCaptureConfig(blocks)) {
    return {
      blocks,
      applied: false,
    };
  }

  return {
    blocks: [...blocks, buildDefaultLeadCaptureConfigBlock()],
    applied: true,
  };
};
