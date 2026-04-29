type FlowGraphVersion = 1;

enum FlowOutcome {
  DEFAULT = 'default',
  SUBMIT_SUCCESS = 'submit_success',
  SUBMIT_REFUSAL = 'submit_refusal',
  ACCEPT = 'accept',
  DECLINE = 'decline',
  TIMEOUT = 'timeout',
  HANDOFF_COMPLETE = 'handoff_complete',
}

enum FlowNodeRole {
  ENTRY = 'entry',
  OFFER = 'offer',
  UPSELL = 'upsell',
  DOWNSELL = 'downsell',
  THANK_YOU = 'thank_you',
  TERMINAL = 'terminal',
}

interface FlowExit {
  outcome: FlowOutcome | string;
  toStepId: string;
  label?: string | null;
  priority?: number;
}

interface FlowNode {
  stepId: string;
  slug: string;
  stepType: string;
  role: FlowNodeRole | string;
  isTerminal?: boolean;
  externalUrlTemplate?: string | null;
  exits: Record<string, FlowExit>;
}

interface FlowGraphV1 {
  version: FlowGraphVersion;
  entryStepId: string | null;
  defaultOutcome: FlowOutcome | string;
  nodes: Record<string, FlowNode>;
}

export class FunnelGraphMockGenerator {
  buildFiveStepValueLadder(input?: { withErrors?: boolean }): FlowGraphV1 {
    const withErrors = input?.withErrors === true;

    const graph: FlowGraphV1 = {
      version: 1,
      entryStepId: 'step_vsl_entry',
      defaultOutcome: FlowOutcome.DEFAULT,
      nodes: {
        step_vsl_entry: {
          stepId: 'step_vsl_entry',
          slug: 'vsl-principal',
          stepType: 'vsl',
          role: FlowNodeRole.ENTRY,
          externalUrlTemplate: withErrors
            ? 'https://checkout.hotmart.com/ABC?email={{lead.email}}&card={{lead.tarjeta_credito}}'
            : 'https://checkout.hotmart.com/ABC?email={{lead.email}}',
          exits: {
            [FlowOutcome.SUBMIT_SUCCESS]: {
              outcome: FlowOutcome.SUBMIT_SUCCESS,
              toStepId: 'step_oto_1',
              label: 'Ir a OTO 1',
              priority: 1,
            },
          },
        },
        step_oto_1: {
          stepId: 'step_oto_1',
          slug: 'oto-1',
          stepType: 'offer',
          role: FlowNodeRole.UPSELL,
          exits: {
            [FlowOutcome.ACCEPT]: {
              outcome: FlowOutcome.ACCEPT,
              toStepId: 'step_oto_2',
              label: 'Aceptar OTO 1',
              priority: 1,
            },
            [FlowOutcome.DECLINE]: {
              outcome: FlowOutcome.DECLINE,
              toStepId: withErrors
                ? 'downsell_fantasma'
                : 'step_downsell',
              label: 'Rechazar OTO 1',
              priority: 2,
            },
          },
        },
        step_downsell: {
          stepId: 'step_downsell',
          slug: 'downsell',
          stepType: 'offer',
          role: FlowNodeRole.DOWNSELL,
          exits: {
            [FlowOutcome.ACCEPT]: {
              outcome: FlowOutcome.ACCEPT,
              toStepId: 'step_oto_2',
              label: 'Aceptar downsell',
              priority: 1,
            },
            [FlowOutcome.DECLINE]: {
              outcome: FlowOutcome.DECLINE,
              toStepId: 'step_oto_2',
              label: 'Rechazar downsell',
              priority: 2,
            },
          },
        },
        step_oto_2: {
          stepId: 'step_oto_2',
          slug: 'oto-2',
          stepType: 'offer',
          role: FlowNodeRole.UPSELL,
          exits: {
            [FlowOutcome.ACCEPT]: {
              outcome: FlowOutcome.ACCEPT,
              toStepId: 'step_thank_you',
              label: 'Aceptar OTO 2',
              priority: 1,
            },
            [FlowOutcome.DECLINE]: {
              outcome: FlowOutcome.DECLINE,
              toStepId: 'step_thank_you',
              label: 'Rechazar OTO 2',
              priority: 2,
            },
          },
        },
        step_thank_you: {
          stepId: 'step_thank_you',
          slug: 'gracias',
          stepType: 'thank_you',
          role: FlowNodeRole.TERMINAL,
          isTerminal: true,
          exits: {},
        },
      },
    };

    if (withErrors) {
      graph.nodes.step_vip_support = {
        stepId: 'step_vip_support',
        slug: 'soporte-vip',
        stepType: 'support',
        role: FlowNodeRole.OFFER,
        exits: {
          [FlowOutcome.DEFAULT]: {
            outcome: FlowOutcome.DEFAULT,
            toStepId: 'step_thank_you',
            label: 'Cerrar soporte VIP',
            priority: 1,
          },
        },
      };
    }

    return graph;
  }
}
