import { Prisma } from '@prisma/client';
import { lintFunnelDraft } from '../../../../packages/shared/funnel-lint/src/lint-funnel-draft';
import type {
  FunnelLintReport,
  JsonValue,
} from '../../../../packages/shared/funnel-lint/src/types';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

type RepairStep = {
  id: string;
};

type RepairInstance = {
  id: string;
  name: string;
  conversionContract: Prisma.JsonValue;
  settingsJson?: Prisma.JsonValue | null;
  funnel?: {
    config: Prisma.JsonValue;
  } | null;
  steps: RepairStep[];
};

type RepairCandidate = RepairInstance & {
  funnel?: {
    config: Prisma.JsonValue;
  } | null;
};

type RepairPrismaClient = {
  funnelInstance: {
    findUnique: (args: unknown) => Promise<RepairInstance | null>;
    findMany: (args: unknown) => Promise<RepairCandidate[]>;
    update: (args: unknown) => Promise<unknown>;
  };
};

type RepairSummary = {
  instanceId: string;
  name: string;
  changed: boolean;
  before: {
    nodeKeys: string[];
    errorCount: number;
    issueCount: number;
    status: string;
  };
  after: {
    nodeKeys: string[];
    errorCount: number;
    issueCount: number;
    status: string;
  };
};

const getFlowGraph = (conversionContract: Prisma.JsonValue) => {
  const contract = isRecord(conversionContract) ? conversionContract : null;
  const flowGraph = isRecord(contract?.flowGraph) ? contract.flowGraph : null;
  const nodes = isRecord(flowGraph?.nodes) ? flowGraph.nodes : null;

  if (!contract || !flowGraph || !nodes) {
    return null;
  }

  return {
    contract,
    flowGraph,
    nodes,
  };
};

const summarizeLint = (
  conversionContract: Prisma.JsonValue,
): RepairSummary['before'] => {
  const flowGraph = getFlowGraph(conversionContract);
  const report: FunnelLintReport = lintFunnelDraft({
    blocksJson: [],
    structuralType: 'multi_step_conversion',
    conversionContract: conversionContract as JsonValue,
  });

  return {
    nodeKeys: flowGraph ? Object.keys(flowGraph.nodes) : [],
    errorCount: report.issues.filter((issue) => issue.severity === 'error')
      .length,
    issueCount: report.issues.length,
    status: report.status,
  };
};

const hasCloneSourceMarker = (value: unknown) => {
  const record = isRecord(value) ? value : null;
  const source = typeof record?.source === 'string' ? record.source : '';

  return (
    source.includes('funnel_arsenal') ||
    source.includes('marketplace') ||
    source.includes('master_clone')
  );
};

export const isFunnelFlowGraphRepairCandidate = (
  instance: RepairCandidate,
) =>
  hasCloneSourceMarker(instance.conversionContract) ||
  hasCloneSourceMarker(instance.settingsJson) ||
  hasCloneSourceMarker(instance.funnel?.config);

export const repairFlowGraphNodeKeysForCurrentSteps = (
  conversionContract: Prisma.JsonValue,
  steps: RepairStep[],
) => {
  const flowGraph = getFlowGraph(conversionContract);
  if (!flowGraph) {
    return {
      changed: false,
      conversionContract: (conversionContract ?? {}) as JsonValue,
    };
  }

  const currentStepIds = new Set(steps.map((step) => step.id));
  const nextNodes: Record<string, unknown> = {};
  let changed = false;

  for (const [nodeKey, node] of Object.entries(flowGraph.nodes)) {
    const nodeRecord = isRecord(node) ? node : null;
    const nodeStepId =
      typeof nodeRecord?.stepId === 'string' ? nodeRecord.stepId.trim() : '';
    const nextNodeKey =
      nodeStepId && currentStepIds.has(nodeStepId) ? nodeStepId : nodeKey;

    if (nextNodeKey !== nodeKey) {
      changed = true;
    }

    nextNodes[nextNodeKey] =
      nodeRecord && nodeStepId
        ? {
            ...nodeRecord,
            stepId: nextNodeKey,
          }
        : node;
  }

  if (!changed) {
    return {
      changed: false,
      conversionContract: conversionContract as JsonValue,
    };
  }

  return {
    changed: true,
    conversionContract: {
      ...flowGraph.contract,
      flowGraph: {
        ...flowGraph.flowGraph,
        nodes: nextNodes,
      },
    } as JsonValue,
  };
};

export const repairFunnelFlowGraphNodeKeys = async (
  prisma: RepairPrismaClient,
  input: {
    funnelInstanceId?: string | null;
  } = {},
) => {
  const records = input.funnelInstanceId
    ? [
        await prisma.funnelInstance.findUnique({
          where: {
            id: input.funnelInstanceId,
          },
          select: {
            id: true,
            name: true,
            conversionContract: true,
            steps: {
              select: {
                id: true,
              },
            },
          },
        }),
      ].filter((record): record is RepairInstance => Boolean(record))
    : (
        await prisma.funnelInstance.findMany({
          select: {
            id: true,
            name: true,
            conversionContract: true,
            settingsJson: true,
            funnel: {
              select: {
                config: true,
              },
            },
            steps: {
              select: {
                id: true,
              },
            },
          },
        })
      ).filter(isFunnelFlowGraphRepairCandidate);

  const summaries: RepairSummary[] = [];

  for (const record of records) {
    const before = summarizeLint(record.conversionContract);
    const repair = repairFlowGraphNodeKeysForCurrentSteps(
      record.conversionContract,
      record.steps,
    );
    const after = summarizeLint(repair.conversionContract as Prisma.JsonValue);

    if (repair.changed) {
      await prisma.funnelInstance.update({
        where: {
          id: record.id,
        },
        data: {
          conversionContract: toInputJson(repair.conversionContract),
        },
      });
    }

    summaries.push({
      instanceId: record.id,
      name: record.name,
      changed: repair.changed,
      before,
      after,
    });
  }

  return summaries;
};

export type { RepairSummary };
