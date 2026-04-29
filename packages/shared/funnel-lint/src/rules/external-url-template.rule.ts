import {
  FlowGraphV1,
  FlowNodeRole,
} from "../flow-graph.types";
import type { FunnelLintIssue } from "../types";

export const INVALID_EXTERNAL_URL_TEMPLATE = "INVALID_EXTERNAL_URL_TEMPLATE";
export const MISSING_EXTERNAL_URL = "MISSING_EXTERNAL_URL";

export const ALLOWED_EXTERNAL_URL_TEMPLATE_TOKENS = new Set([
  "lead.id",
  "lead.email",
  "lead.fullName",
  "lead.phone",
  "funnel.id",
  "funnel.code",
  "funnel.name",
  "publication.id",
  "publication.pathPrefix",
  "step.id",
  "step.slug",
]);

const TEMPLATE_TOKEN_REGEX = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

const normalizeRole = (role: string) => role.trim().toLowerCase();

const collectTemplateTokens = (value: string) =>
  Array.from(value.matchAll(TEMPLATE_TOKEN_REGEX)).map((match) => match[1] ?? "");

const stripTemplateTokens = (value: string) =>
  value.replace(TEMPLATE_TOKEN_REGEX, "placeholder");

export const isValidExternalUrlTemplate = (value: string) => {
  const normalized = stripTemplateTokens(value.trim());

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

export const lintExternalUrlTemplateRule = (
  graph: FlowGraphV1,
): FunnelLintIssue[] => {
  const issues: FunnelLintIssue[] = [];

  for (const node of Object.values(graph.nodes)) {
    const role = normalizeRole(String(node.role));
    const externalUrlTemplate = node.externalUrlTemplate?.trim() || "";
    const hasInternalExits = Object.keys(node.exits ?? {}).length > 0;

    if (externalUrlTemplate) {
      if (!isValidExternalUrlTemplate(externalUrlTemplate)) {
        issues.push({
          code: INVALID_EXTERNAL_URL_TEMPLATE,
          severity: "error",
          message:
            "El externalUrlTemplate no tiene un formato de URL valido.",
          stepId: node.stepId,
          autofixAvailable: false,
        });
      }

      const invalidTokens = collectTemplateTokens(externalUrlTemplate).filter(
        (token) => !ALLOWED_EXTERNAL_URL_TEMPLATE_TOKENS.has(token),
      );

      if (invalidTokens.length > 0) {
        issues.push({
          code: INVALID_EXTERNAL_URL_TEMPLATE,
          severity: "error",
          message: `El externalUrlTemplate usa placeholders no permitidos: ${invalidTokens.join(
            ", ",
          )}.`,
          stepId: node.stepId,
          autofixAvailable: false,
        });
      }
    }

    if (
      role === FlowNodeRole.REDIRECT &&
      !externalUrlTemplate &&
      !hasInternalExits
    ) {
      issues.push({
        code: MISSING_EXTERNAL_URL,
        severity: "warning",
        message:
          "El nodo REDIRECT no tiene externalUrlTemplate ni salida interna definida.",
        stepId: node.stepId,
        autofixAvailable: false,
      });
    }
  }

  return issues;
};

export const lintExternalUrlTemplates = lintExternalUrlTemplateRule;
