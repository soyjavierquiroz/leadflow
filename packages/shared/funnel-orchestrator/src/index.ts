export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonRecord;

export type JsonRecord = {
  [key: string]: JsonValue | undefined;
};

export type FunnelBlock = JsonRecord & {
  type: string;
  key?: string;
  block_id?: string;
};

export type FunnelStepType =
  | "landing"
  | "lead_capture"
  | "thank_you"
  | "vsl"
  | "presentation"
  | "qualification"
  | "cta_bridge"
  | "handoff"
  | "confirmation"
  | "redirect";

export type FunnelCapability = "lead_capture" | "media" | "checkout" | string;

export type BusinessOutcome =
  | "view"
  | "cta_click"
  | "submit_success"
  | "handoff_started"
  | string;

export type AutoWiringRule = {
  when: "inserted" | "recipe_applied" | "save";
  ensureBlockType?: string;
  bindFields?: Record<string, JsonValue>;
};

export type SmartBlockDefinition = {
  key: string;
  example: Record<string, JsonValue>;
  compatibleStepTypes: FunnelStepType[];
  requiredCapabilities: FunnelCapability[];
  emitsOutcomes: BusinessOutcome[];
  autoWiring: AutoWiringRule[];
};

export type SmartWiringRecipe = {
  key: string;
  name: string;
  description: string;
  compatibleStepTypes: FunnelStepType[];
  blockTypes: string[];
  requiredCapabilities: FunnelCapability[];
  successRedirect?: string;
};

export type InsertBlockInput = {
  blocks: unknown;
  definition: SmartBlockDefinition;
  stepType?: string | null;
  successRedirect?: string | null;
};

export type ApplyRecipeInput = {
  blocks?: unknown;
  recipe: SmartWiringRecipe;
  catalog: SmartBlockDefinition[];
  stepType?: string | null;
  successRedirect?: string | null;
  replace?: boolean;
};

export type SyncSuccessRedirectInput = {
  blocks: unknown;
  successRedirect: string;
};

export type ReorderBlocksInput = {
  blocks: unknown;
  activeBlockId: string;
  overBlockId: string;
};

const LEAD_CAPTURE_CONFIG_TYPE = "lead_capture_config";

const STEP_TYPE_ALIASES: Record<string, FunnelStepType> = {
  LANDING: "landing",
  Landing: "landing",
  VSL: "vsl",
  Vsl: "vsl",
  LEAD_CAPTURE: "lead_capture",
  LeadCapture: "lead_capture",
  THANK_YOU: "thank_you",
  ThankYou: "thank_you",
  CONFIRMATION: "confirmation",
  Confirmation: "confirmation",
  HANDOFF: "handoff",
  Handoff: "handoff",
  REDIRECT: "redirect",
  Redirect: "redirect",
  captura: "lead_capture",
  Captura: "lead_capture",
  confirmacion: "confirmation",
  Confirmacion: "confirmation",
  confirmado: "confirmation",
  Confirmado: "confirmation",
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseBlocksArray = (value: unknown): FunnelBlock[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord).map((block) => ({ ...block })) as FunnelBlock[];
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? (parsed.filter(isRecord).map((block) => ({ ...block })) as FunnelBlock[])
      : [];
  } catch {
    return [];
  }
};

const normalizeStepType = (value?: string | null): FunnelStepType | null => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return STEP_TYPE_ALIASES[trimmed] ?? (trimmed.toLowerCase() as FunnelStepType);
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const stableHash = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const normalizePath = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "/confirmado";
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("#")) {
    return trimmed;
  }

  return `/${trimmed.replace(/^\/+/, "")}`;
};

const getBlockType = (block: FunnelBlock) =>
  typeof block.type === "string" ? block.type : "";

const blockIdentity = (block: FunnelBlock, index: number) => {
  const type = slugify(getBlockType(block) || "block");
  const preferred = [block.block_id, block.key]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(slugify)[0];

  return preferred || `${type}_${index + 1}`;
};

const withStableBlockIds = (blocks: FunnelBlock[]) =>
  blocks.map((block, index) => {
    if (typeof block.block_id === "string" && block.block_id.trim()) {
      return block;
    }

    return {
      ...block,
      block_id: blockIdentity(block, index),
    };
  });

const buildStableSingletonId = (type: string) => `${slugify(type)}__singleton`;

const stableBlockId = (blockType: string, scope = "default") =>
  `${slugify(blockType)}_${stableHash(`${blockType}:${scope}`)}`;

const buildDefaultLeadCaptureConfigBlock = (
  successRedirect?: string | null,
  sourceBlockId?: string | null,
): FunnelBlock => ({
  type: LEAD_CAPTURE_CONFIG_TYPE,
  key: "lead-capture-config-singleton",
  block_id: buildStableSingletonId(LEAD_CAPTURE_CONFIG_TYPE),
  bound_to_block_id: sourceBlockId ?? null,
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
  success_redirect: normalizePath(successRedirect ?? "/confirmado"),
  auto_injected: true,
});

const cloneBlock = (block: Record<string, JsonValue>): FunnelBlock =>
  JSON.parse(JSON.stringify(block)) as FunnelBlock;

const bindFields = (
  block: FunnelBlock,
  fields: Record<string, JsonValue> | undefined,
) => {
  if (!fields) {
    return block;
  }

  return {
    ...block,
    ...fields,
  };
};

const hasBlockType = (blocks: FunnelBlock[], type: string) =>
  blocks.some((block) => getBlockType(block) === type);

const recursivelySyncSuccessRedirect = (
  value: JsonValue | undefined,
  successRedirect: string,
): JsonValue | undefined => {
  if (Array.isArray(value)) {
    return value.map((item) =>
      recursivelySyncSuccessRedirect(item, successRedirect),
    ) as JsonValue[];
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key === "success_redirect"
        ? successRedirect
        : recursivelySyncSuccessRedirect(entry, successRedirect),
    ]),
  ) as JsonRecord;
};

const ensureLeadCaptureCapability = (
  blocks: FunnelBlock[],
  capabilities: FunnelCapability[],
  successRedirect?: string | null,
  sourceBlockId?: string | null,
) => {
  if (!capabilities.includes("lead_capture")) {
    return blocks;
  }

  if (hasBlockType(blocks, LEAD_CAPTURE_CONFIG_TYPE)) {
    return blocks;
  }

  return [
    ...blocks,
    buildDefaultLeadCaptureConfigBlock(successRedirect, sourceBlockId),
  ];
};

const applyAutoWiringRules = (
  blocks: FunnelBlock[],
  rules: AutoWiringRule[],
  successRedirect?: string | null,
) => {
  let nextBlocks = blocks;

  for (const rule of rules) {
    if (rule.when !== "inserted" && rule.when !== "recipe_applied") {
      continue;
    }

    if (rule.ensureBlockType && !hasBlockType(nextBlocks, rule.ensureBlockType)) {
      const singleton =
        rule.ensureBlockType === LEAD_CAPTURE_CONFIG_TYPE
          ? buildDefaultLeadCaptureConfigBlock(successRedirect)
          : ({
              type: rule.ensureBlockType,
              key: `${slugify(rule.ensureBlockType)}-singleton`,
              block_id: buildStableSingletonId(rule.ensureBlockType),
              auto_injected: true,
            } satisfies FunnelBlock);

      nextBlocks = [...nextBlocks, singleton];
    }
  }

  return nextBlocks;
};

export const SmartWiringService = {
  normalizeStepType,

  isCompatible(
    definition: Pick<SmartBlockDefinition, "compatibleStepTypes">,
    stepType?: string | null,
  ) {
    const normalized = normalizeStepType(stepType);

    return !normalized || definition.compatibleStepTypes.includes(normalized);
  },

  stableBlockId(blockType: string, scope = "default") {
    return stableBlockId(blockType, scope);
  },

  insertBlock(input: InsertBlockInput) {
    const existingBlocks = parseBlocksArray(input.blocks);
    const autoBindFields = input.definition.autoWiring.reduce<
      Record<string, JsonValue>
    >((fields, rule) => ({ ...fields, ...(rule.bindFields ?? {}) }), {});
    const insertedBlock = bindFields(cloneBlock(input.definition.example), autoBindFields);
    const scopedIdentity = `${input.definition.key}:${existingBlocks.length}`;
    const normalizedInsertedBlock: FunnelBlock = {
      ...insertedBlock,
      type:
        typeof insertedBlock.type === "string"
          ? insertedBlock.type
          : input.definition.key,
      key:
        typeof insertedBlock.key === "string" && insertedBlock.key.trim()
          ? insertedBlock.key
          : `${slugify(input.definition.key)}-${existingBlocks.length + 1}`,
      block_id:
        typeof insertedBlock.block_id === "string" && insertedBlock.block_id.trim()
          ? insertedBlock.block_id
          : stableBlockId(input.definition.key, scopedIdentity),
    };

    const withInserted = [...existingBlocks, normalizedInsertedBlock];
    const withCapabilities = ensureLeadCaptureCapability(
      withInserted,
      input.definition.requiredCapabilities,
      input.successRedirect,
      normalizedInsertedBlock.block_id,
    );
    const withRules = applyAutoWiringRules(
      withCapabilities,
      input.definition.autoWiring,
      input.successRedirect,
    );

    return withStableBlockIds(
      input.successRedirect
        ? SmartWiringService.syncSuccessRedirect({
            blocks: withRules,
            successRedirect: input.successRedirect,
          })
        : withRules,
    );
  },

  applyRecipe(input: ApplyRecipeInput) {
    const byKey = new Map(input.catalog.map((definition) => [definition.key, definition]));
    const seedBlocks = input.replace ? [] : parseBlocksArray(input.blocks);
    const recipeBlocks = input.recipe.blockTypes
      .map((blockType, index) => {
        const definition = byKey.get(blockType);

        if (!definition) {
          return null;
        }

        const autoBindFields = definition.autoWiring.reduce<
          Record<string, JsonValue>
        >((fields, rule) => ({ ...fields, ...(rule.bindFields ?? {}) }), {});
        const block = bindFields(cloneBlock(definition.example), autoBindFields);

        return {
          ...block,
          type: typeof block.type === "string" ? block.type : definition.key,
          key:
            typeof block.key === "string" && block.key.trim()
              ? block.key
              : `${slugify(definition.key)}-${index + 1}`,
          block_id: stableBlockId(definition.key, input.recipe.key),
        } satisfies FunnelBlock;
      })
      .filter(
        (
          block,
        ): block is {
          type: string;
          key: string;
          block_id: string;
        } & JsonRecord => block !== null,
      );
    const requiredCapabilities = [
      ...input.recipe.requiredCapabilities,
      ...recipeBlocks.flatMap((block) => {
        const definition = byKey.get(getBlockType(block));
        return definition?.requiredCapabilities ?? [];
      }),
    ];
    const withCapabilities = ensureLeadCaptureCapability(
      [...seedBlocks, ...recipeBlocks],
      requiredCapabilities,
      input.successRedirect ?? input.recipe.successRedirect,
    );
    const wired = input.catalog.reduce(
      (blocks, definition) =>
        applyAutoWiringRules(
          blocks,
          definition.autoWiring.filter((rule) => rule.when === "recipe_applied"),
          input.successRedirect ?? input.recipe.successRedirect,
        ),
      withCapabilities,
    );
    const successRedirect =
      input.successRedirect ?? input.recipe.successRedirect ?? null;

    return withStableBlockIds(
      successRedirect
        ? SmartWiringService.syncSuccessRedirect({ blocks: wired, successRedirect })
        : wired,
    );
  },

  syncSuccessRedirect(input: SyncSuccessRedirectInput) {
    const successRedirect = normalizePath(input.successRedirect);

    return withStableBlockIds(
      parseBlocksArray(input.blocks).map((block) =>
        recursivelySyncSuccessRedirect(block, successRedirect),
      ) as FunnelBlock[],
    );
  },

  reorderBlocks(input: ReorderBlocksInput) {
    const blocks = withStableBlockIds(parseBlocksArray(input.blocks));
    const fromIndex = blocks.findIndex(
      (block) => block.block_id === input.activeBlockId,
    );
    const toIndex = blocks.findIndex(
      (block) => block.block_id === input.overBlockId,
    );

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return blocks;
    }

    const nextBlocks = [...blocks];
    const [movedBlock] = nextBlocks.splice(fromIndex, 1);
    nextBlocks.splice(toIndex, 0, movedBlock);

    return nextBlocks;
  },

  serialize(blocks: unknown) {
    return JSON.stringify(blocks, null, 2);
  },
};

export const readyMadeFunnelRecipes: SmartWiringRecipe[] = [
  {
    key: "landing_capture_system",
    name: "Sistema Hero + Captura",
    description:
      "Hero, formulario nativo y configuracion singleton listos para capturar leads.",
    compatibleStepTypes: ["landing", "lead_capture", "vsl", "presentation"],
    blockTypes: ["hero", LEAD_CAPTURE_CONFIG_TYPE, "lead_capture_form"],
    requiredCapabilities: ["lead_capture"],
    successRedirect: "/confirmado",
  },
  {
    key: "vsl_modal_capture_system",
    name: "Sistema VSL + Modal",
    description:
      "Hook principal cableado al modal y configuracion de captura compartida.",
    compatibleStepTypes: ["landing", "vsl", "presentation"],
    blockTypes: ["hook_and_promise", LEAD_CAPTURE_CONFIG_TYPE],
    requiredCapabilities: ["lead_capture"],
    successRedirect: "/confirmado",
  },
  {
    key: "thank_you_handoff_system",
    name: "Sistema Confirmacion + WhatsApp",
    description:
      "Pantalla de confirmacion y CTA de handoff para pasos posteriores a la captura.",
    compatibleStepTypes: ["thank_you", "confirmation", "handoff", "redirect"],
    blockTypes: ["conversion_page_config", "whatsapp_handoff_cta"],
    requiredCapabilities: [],
  },
];
