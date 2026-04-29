import { unstable_noStore as noStore } from "next/cache";

import { apiFetchWithSession } from "@/lib/auth";
import {
  defaultBuilderBlockDefinitions,
  type BuilderBlockDefinition,
} from "@/lib/blocks/catalog";
import type { JsonValue } from "@/lib/public-funnel-runtime.types";

type RemoteBlockDefinitionRecord = {
  key: string;
  name: string;
  description: string | null;
  category: string;
  schemaJson: Record<string, unknown>;
  exampleJson: Record<string, unknown>;
  compatibleStepTypes?: BuilderBlockDefinition["compatibleStepTypes"] | null;
  requiredCapabilities?: BuilderBlockDefinition["requiredCapabilities"] | null;
  emitsOutcomes?: BuilderBlockDefinition["emitsOutcomes"] | null;
  autoWiring?: BuilderBlockDefinition["autoWiring"] | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toJsonRecord = (value: Record<string, unknown>): Record<string, JsonValue> =>
  value as Record<string, JsonValue>;

const mergeBlockDefinitions = (remoteDefinitions: BuilderBlockDefinition[]) => {
  const merged = new Map<string, BuilderBlockDefinition>();

  for (const definition of defaultBuilderBlockDefinitions) {
    merged.set(definition.key, definition);
  }

  for (const definition of remoteDefinitions) {
    merged.set(definition.key, definition);
  }

  return Array.from(merged.values());
};

export const getSystemBlockDefinitions = async (): Promise<
  BuilderBlockDefinition[]
> => {
  noStore();

  try {
    const response = await apiFetchWithSession("/system/block-definitions");

    if (!response.ok) {
      return defaultBuilderBlockDefinitions;
    }

    const payload = (await response.json()) as unknown;

    if (!Array.isArray(payload)) {
      return defaultBuilderBlockDefinitions;
    }

    const mapped = payload.reduce<BuilderBlockDefinition[]>(
      (accumulator, item) => {
        const record = item as RemoteBlockDefinitionRecord;

        if (
          typeof record?.key !== "string" ||
          typeof record?.name !== "string" ||
          typeof record?.category !== "string" ||
          !isRecord(record?.schemaJson) ||
          !isRecord(record?.exampleJson)
        ) {
          return accumulator;
        }

        accumulator.push({
          key: record.key,
          name: record.name,
          description: record.description ?? "",
          category: record.category,
          schema: toJsonRecord(record.schemaJson),
          example: toJsonRecord(record.exampleJson),
          compatibleStepTypes: record.compatibleStepTypes ?? [],
          requiredCapabilities: record.requiredCapabilities ?? [],
          emitsOutcomes: record.emitsOutcomes ?? [],
          autoWiring: record.autoWiring ?? [],
        });

        return accumulator;
      },
      [],
    );

    return mapped.length > 0
      ? mergeBlockDefinitions(mapped)
      : defaultBuilderBlockDefinitions;
  } catch {
    return defaultBuilderBlockDefinitions;
  }
};
