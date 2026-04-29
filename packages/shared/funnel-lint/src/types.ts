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
};

export type FunnelRuntimeHealthStatus = "healthy" | "warning" | "broken";

export type FunnelLintSeverity = "error" | "warning" | "info";

export type FunnelLintIssue = {
  code: string;
  severity: FunnelLintSeverity;
  message: string;
  blockKey?: string;
  blockIndex?: number;
  stepId?: string;
  targetStepId?: string;
  autofixAvailable: boolean;
};

export type FunnelLintReport = {
  status: FunnelRuntimeHealthStatus;
  issues: FunnelLintIssue[];
  appliedFixes: string[];
};

export type FunnelLintStepReference = {
  id?: string;
  slug?: string;
  path: string;
  position?: number;
  isEntryStep?: boolean;
  isConversionStep?: boolean;
};

export type FunnelLintInput = {
  blocksJson: JsonValue;
  currentStep?: FunnelLintStepReference | null;
  nextStep?: FunnelLintStepReference | null;
  nextStepPath?: string | null;
  structuralType?: string | null;
  conversionContract?: JsonValue;
};

export type HealedFunnelDraft = {
  blocksJson: FunnelBlock[];
  report: FunnelLintReport;
};
