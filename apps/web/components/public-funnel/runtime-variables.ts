import type {
  JsonValue,
  PublicFunnelRuntimePayload,
} from "@/lib/public-funnel-runtime.types";

const VARIABLE_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

const firstName = (value: string | null | undefined) =>
  value?.trim().split(/\s+/)[0] ?? "";

const stringValue = (value: string | number | boolean | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

const isRecord = (value: JsonValue | null | undefined): value is Record<string, JsonValue> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readNestedString = (value: JsonValue | null | undefined, path: string[]) => {
  let cursor: JsonValue | null | undefined = value;

  for (const segment of path) {
    if (!isRecord(cursor)) {
      return "";
    }

    cursor = cursor[segment];
  }

  return typeof cursor === "string" || typeof cursor === "number"
    ? String(cursor)
    : "";
};

const getSponsor = (runtime: PublicFunnelRuntimePayload) =>
  runtime.assignedSponsor ??
  runtime.assignment?.sponsor ??
  runtime.handoff.sponsor ??
  null;

export const buildRuntimeVariableDictionary = (
  runtime: PublicFunnelRuntimePayload,
) => {
  const sponsor = getSponsor(runtime);
  const sponsorName = runtime.advisor?.name || sponsor?.displayName || "";
  const sponsorPhone =
    runtime.advisor?.phone ||
    runtime.handoff.whatsappPhone ||
    sponsor?.phone ||
    "";
  const audienceLabel =
    readNestedString(runtime.currentStep.settingsJson, ["team", "audience_label"]) ||
    readNestedString(runtime.funnel.settingsJson, ["team", "audience_label"]) ||
    readNestedString(runtime.funnel.settingsJson, ["audience_label"]) ||
    runtime.team.description ||
    runtime.team.name;

  return new Map<string, string>([
    ["team.id", runtime.team.id],
    ["team.name", runtime.team.name],
    ["team.audience_label", audienceLabel],
    ["team.audienceLabel", audienceLabel],
    ["team.description", runtime.team.description ?? ""],
    ["sponsor.id", sponsor?.id ?? ""],
    ["sponsor.name", sponsorName],
    ["sponsor.display_name", sponsorName],
    ["sponsor.displayName", sponsorName],
    ["sponsor.first_name", firstName(sponsorName)],
    ["sponsor.firstName", firstName(sponsorName)],
    ["sponsor.phone", sponsorPhone],
    ["sponsor.whatsapp", runtime.handoff.whatsappUrl ?? ""],
    ["advisor.name", runtime.advisor?.name ?? sponsorName],
    ["advisor.first_name", firstName(runtime.advisor?.name ?? sponsorName)],
    ["advisor.phone", runtime.advisor?.phone ?? sponsorPhone],
    ["advisor.whatsapp", runtime.advisor?.whatsappUrl ?? runtime.handoff.whatsappUrl ?? ""],
    ["funnel.id", runtime.funnel.id],
    ["funnel.name", runtime.funnel.name],
    ["funnel.code", runtime.funnel.code],
    ["funnel.status", runtime.funnel.status],
    ["publication.id", runtime.publication.id],
    ["publication.pathPrefix", runtime.publication.pathPrefix],
    ["publication.path_prefix", runtime.publication.pathPrefix],
    ["publication.nextStepPath", runtime.publication.nextStepPath ?? ""],
    ["domain.host", runtime.domain.host],
    ["request.path", runtime.request.path],
  ]);
};

export const resolveRuntimeVariables = (
  value: string,
  runtime: PublicFunnelRuntimePayload,
) => {
  const dictionary = buildRuntimeVariableDictionary(runtime);

  return value.replace(VARIABLE_PATTERN, (match, rawKey: string) => {
    const key = rawKey.trim();
    const replacement = dictionary.get(key);

    return replacement === undefined ? "" : stringValue(replacement);
  });
};
