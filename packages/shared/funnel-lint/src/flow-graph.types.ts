export type FlowGraphVersion = 1;

export enum FlowOutcome {
  DEFAULT = "default",
  SUBMIT_SUCCESS = "submit_success",
  SUBMIT_REFUSAL = "submit_refusal",
  ACCEPT = "accept",
  DECLINE = "decline",
  TIMEOUT = "timeout",
  HANDOFF_COMPLETE = "handoff_complete",
}

export enum FlowNodeRole {
  ENTRY = "entry",
  CAPTURE = "capture",
  CONTENT = "content",
  OFFER = "offer",
  UPSELL = "upsell",
  DOWNSELL = "downsell",
  THANK_YOU = "thank_you",
  REDIRECT = "redirect",
  TERMINAL = "terminal",
}

export type FlowNodeId = string;
export type FunnelStepId = string;

export interface FlowExitCondition {
  type: "always" | "field_equals" | "field_present" | "lead_status";
  field?: string;
  value?: string;
}

export interface FlowExit {
  outcome: FlowOutcome | string;
  toStepId: FunnelStepId;
  label?: string | null;
  priority?: number;
  condition?: FlowExitCondition | null;
}

export interface FlowNodeMeta {
  title?: string;
  description?: string;
  editorColor?: string;
  editorPosition?: {
    x: number;
    y: number;
  };
}

export interface FlowNode {
  stepId: FunnelStepId;
  slug: string;
  stepType: string;
  role: FlowNodeRole | string;
  isTerminal?: boolean;
  externalUrlTemplate?: string | null;
  meta?: FlowNodeMeta;
  exits: Record<string, FlowExit>;
}

export interface FlowGraphV1 {
  version: FlowGraphVersion;
  entryStepId: FunnelStepId | null;
  defaultOutcome: FlowOutcome | string;
  nodes: Record<FlowNodeId, FlowNode>;
}

export interface ConversionContractV1 {
  flowGraph: FlowGraphV1;
}
