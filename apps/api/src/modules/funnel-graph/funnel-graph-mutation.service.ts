import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  FunnelStepType,
  Prisma,
  UserRole,
} from '@prisma/client';
import {
  FlowNodeRole,
  type FlowExit,
  type FlowGraphV1,
  type FlowNode,
} from '../../../../../packages/shared/funnel-lint/src/flow-graph.types';
import { lintFunnelDraft } from '../../../../../packages/shared/funnel-lint/src/lint-funnel-draft';
import type {
  FunnelLintReport,
  JsonValue,
} from '../../../../../packages/shared/funnel-lint/src/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RuntimeContextConfigSyncService } from '../runtime-context/runtime-context-config-sync.service';
import { TemplateService } from '../templates/template.service';

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export type AddFlowNodeInput = {
  role: FlowNodeRole | string;
  title?: string | null;
  slug?: string | null;
  templateKey?: string | null;
  stepType?: FunnelStepType | string | null;
  externalUrlTemplate?: string | null;
  isTerminal?: boolean;
  exits?: Record<string, FlowExit>;
};

export type ConnectFlowNodesInput = {
  fromStepId: string;
  toStepId: string;
  outcome: string;
  label?: string | null;
  priority?: number;
};

export type DisconnectFlowExitInput = {
  fromStepId: string;
  outcome: string;
};

export type UpdateFlowNodeInput = {
  slug?: string | null;
};

export type FlowGraphMutationResult = FunnelLintReport & {
  graph: FlowGraphV1;
};

export type ValidateFlowGraphResult = FlowGraphMutationResult & {
  step: {
    id: string;
    slug: string;
    stepType: FunnelStepType;
    position: number;
  };
};

type FunnelInstanceMutationScope = {
  workspaceId: string;
  teamId?: string | null;
};

@Injectable()
export class FunnelGraphMutationService {
  private readonly logger = new Logger(FunnelGraphMutationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: TemplateService,
    private readonly runtimeContextConfigSyncService: RuntimeContextConfigSyncService,
  ) {}

  async addNodeForUser(
    user: AuthenticatedUser,
    funnelInstanceId: string,
    input: AddFlowNodeInput,
  ): Promise<ValidateFlowGraphResult> {
    if (!user.workspaceId) {
      throw new BadRequestException({
        code: 'WORKSPACE_CONTEXT_REQUIRED',
        message: 'A workspace context is required to mutate a funnel graph.',
      });
    }

    return this.addNode(
      {
        workspaceId: user.workspaceId,
        teamId: user.role === UserRole.SUPER_ADMIN ? null : user.teamId,
      },
      funnelInstanceId,
      input,
    );
  }

  async addNode(
    scope: FunnelInstanceMutationScope,
    funnelInstanceId: string,
    input: AddFlowNodeInput,
  ): Promise<ValidateFlowGraphResult> {
    const role = this.normalizeRole(input.role);
    const stepType = this.normalizeStepType(input.stepType, role, input.templateKey);
    const title = this.normalizeTitle(input.title, role, input.templateKey);
    const requestedSlug = input.slug ? slugify(input.slug) : slugify(title);

    if (!requestedSlug) {
      throw new BadRequestException({
        code: 'FLOW_NODE_SLUG_REQUIRED',
        message: 'A valid slug is required to add a step to the graph.',
      });
    }

    const defaults = await this.templateService.getStepDefaults({
      workspaceId: scope.workspaceId,
      templateKey: input.templateKey,
      stepType,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const funnelInstance = await tx.funnelInstance.findFirst({
        where: {
          id: funnelInstanceId,
          workspaceId: scope.workspaceId,
          ...(scope.teamId ? { teamId: scope.teamId } : {}),
        },
        include: {
          steps: {
            orderBy: { position: 'asc' },
          },
        },
      });

      if (!funnelInstance) {
        throw new NotFoundException({
          code: 'FUNNEL_INSTANCE_NOT_FOUND',
          message: 'The requested funnel instance was not found.',
        });
      }

      const slug = await this.createUniqueSlug(
        tx,
        funnelInstance.id,
        requestedSlug,
      );
      const nextPosition =
        funnelInstance.steps.reduce(
          (maxPosition, step) => Math.max(maxPosition, step.position),
          0,
        ) + 1;

      const step = await tx.funnelStep.create({
        data: {
          workspaceId: funnelInstance.workspaceId,
          teamId: funnelInstance.teamId,
          funnelInstanceId: funnelInstance.id,
          stepType,
          slug,
          position: nextPosition,
          isEntryStep: false,
          isConversionStep: this.isConversionRole(role),
          blocksJson: toInputJson(defaults.blocksJson),
          mediaMap: toInputJson(defaults.mediaMap),
          settingsJson: toInputJson(defaults.settingsJson),
        },
      });

      const graph = this.addStepToGraph(
        this.toFlowGraph(
          funnelInstance.conversionContract as Prisma.JsonValue,
          funnelInstance.steps,
        ),
        {
          stepId: step.id,
          slug: step.slug,
          stepType: step.stepType,
          role,
          isTerminal: input.isTerminal ?? this.isTerminalRole(role),
          externalUrlTemplate: input.externalUrlTemplate?.trim() || null,
          meta: {
            title,
          },
          exits: input.exits ?? {},
        },
      );
      const conversionContract = {
        ...this.toJsonRecord(funnelInstance.conversionContract as Prisma.JsonValue),
        flowGraph: graph,
      };

      await tx.funnelInstance.update({
        where: { id: funnelInstance.id },
        data: {
          conversionContract: toInputJson(conversionContract),
        },
      });

      return {
        funnelInstance,
        graph,
        step,
      };
    });

    await this.safeSyncRuntimeContext({
      tenantId: result.funnelInstance.teamId,
      funnelInstanceId: result.funnelInstance.id,
    });

    const report = lintFunnelDraft({
      blocksJson: [],
      structuralType: result.funnelInstance.structuralType,
      conversionContract: {
        flowGraph: result.graph,
      } as unknown as JsonValue,
    });

    return {
      ...report,
      graph: result.graph,
      step: {
        id: result.step.id,
        slug: result.step.slug,
        stepType: result.step.stepType,
        position: result.step.position,
      },
    };
  }

  async connectNodesForUser(
    user: AuthenticatedUser,
    funnelInstanceId: string,
    input: ConnectFlowNodesInput,
  ): Promise<FlowGraphMutationResult> {
    return this.connectNodes(
      this.scopeFromUser(user),
      funnelInstanceId,
      input,
    );
  }

  async disconnectExitForUser(
    user: AuthenticatedUser,
    funnelInstanceId: string,
    input: DisconnectFlowExitInput,
  ): Promise<FlowGraphMutationResult> {
    return this.disconnectExit(
      this.scopeFromUser(user),
      funnelInstanceId,
      input,
    );
  }

  async removeNodeForUser(
    user: AuthenticatedUser,
    funnelInstanceId: string,
    stepId: string,
  ): Promise<FlowGraphMutationResult> {
    return this.removeNode(this.scopeFromUser(user), funnelInstanceId, stepId);
  }

  async updateNodeForUser(
    user: AuthenticatedUser,
    funnelInstanceId: string,
    stepId: string,
    input: UpdateFlowNodeInput,
  ): Promise<FlowGraphMutationResult> {
    return this.updateNode(
      this.scopeFromUser(user),
      funnelInstanceId,
      stepId,
      input,
    );
  }

  async connectNodes(
    scope: FunnelInstanceMutationScope,
    funnelInstanceId: string,
    input: ConnectFlowNodesInput,
  ): Promise<FlowGraphMutationResult> {
    const fromStepId = this.normalizeStepId(input.fromStepId, 'fromStepId');
    const toStepId = this.normalizeStepId(input.toStepId, 'toStepId');
    const outcome = this.normalizeOutcome(input.outcome);

    const result = await this.updateGraph(scope, funnelInstanceId, (graph) => {
      const fromNode = graph.nodes[fromStepId];
      const toNode = graph.nodes[toStepId];

      if (!fromNode || !toNode) {
        throw new BadRequestException({
          code: 'FLOW_GRAPH_NODE_NOT_FOUND',
          message: 'Both fromStepId and toStepId must exist in the FlowGraph.',
        });
      }

      return {
        ...graph,
        nodes: {
          ...graph.nodes,
          [fromStepId]: {
            ...fromNode,
            exits: {
              ...(fromNode.exits ?? {}),
              [outcome]: {
                outcome,
                toStepId,
                label: input.label ?? null,
                priority: input.priority,
              },
            },
          },
        },
      };
    });

    return this.syncAndLint(result);
  }

  async disconnectExit(
    scope: FunnelInstanceMutationScope,
    funnelInstanceId: string,
    input: DisconnectFlowExitInput,
  ): Promise<FlowGraphMutationResult> {
    const fromStepId = this.normalizeStepId(input.fromStepId, 'fromStepId');
    const outcome = this.normalizeOutcome(input.outcome);

    const result = await this.updateGraph(scope, funnelInstanceId, (graph) => {
      const fromNode = graph.nodes[fromStepId];

      if (!fromNode) {
        throw new BadRequestException({
          code: 'FLOW_GRAPH_NODE_NOT_FOUND',
          message: 'fromStepId must exist in the FlowGraph.',
        });
      }

      const nextExits = { ...(fromNode.exits ?? {}) };
      delete nextExits[outcome];

      return {
        ...graph,
        nodes: {
          ...graph.nodes,
          [fromStepId]: {
            ...fromNode,
            exits: nextExits,
          },
        },
      };
    });

    return this.syncAndLint(result);
  }

  async removeNode(
    scope: FunnelInstanceMutationScope,
    funnelInstanceId: string,
    stepId: string,
  ): Promise<FlowGraphMutationResult> {
    const normalizedStepId = this.normalizeStepId(stepId, 'stepId');

    const result = await this.prisma.$transaction(async (tx) => {
      const funnelInstance = await this.findFunnelInstanceForMutation(
        tx,
        scope,
        funnelInstanceId,
      );
      const graph = this.toFlowGraph(
        funnelInstance.conversionContract as Prisma.JsonValue,
        funnelInstance.steps,
      );
      const node = graph.nodes[normalizedStepId];

      if (!node) {
        throw new BadRequestException({
          code: 'FLOW_GRAPH_NODE_NOT_FOUND',
          message: 'stepId must exist in the FlowGraph.',
        });
      }

      if (graph.entryStepId === normalizedStepId) {
        throw new BadRequestException({
          code: 'FLOW_GRAPH_ENTRY_NODE_IMMUTABLE',
          message: 'The entry node cannot be removed from the FlowGraph.',
        });
      }

      const nextNodes = Object.fromEntries(
        Object.entries(graph.nodes)
          .filter(([candidateStepId]) => candidateStepId !== normalizedStepId)
          .map(([candidateStepId, candidateNode]) => [
            candidateStepId,
            {
              ...candidateNode,
              exits: Object.fromEntries(
                Object.entries(candidateNode.exits ?? {}).filter(
                  ([, exit]) => exit.toStepId !== normalizedStepId,
                ),
              ),
            },
          ]),
      );
      const nextGraph = {
        ...graph,
        nodes: nextNodes,
      };

      await tx.funnelStep.delete({
        where: { id: normalizedStepId },
      });

      await this.persistGraph(tx, funnelInstance, nextGraph);

      return {
        funnelInstance,
        graph: nextGraph,
      };
    });

    return this.syncAndLint(result);
  }

  async updateNode(
    scope: FunnelInstanceMutationScope,
    funnelInstanceId: string,
    stepId: string,
    input: UpdateFlowNodeInput,
  ): Promise<FlowGraphMutationResult> {
    const normalizedStepId = this.normalizeStepId(stepId, 'stepId');
    const requestedSlug =
      input.slug == null ? undefined : input.slug.trim() === '' ? '' : slugify(input.slug);

    const result = await this.prisma.$transaction(async (tx) => {
      const funnelInstance = await this.findFunnelInstanceForMutation(
        tx,
        scope,
        funnelInstanceId,
      );
      const graph = this.toFlowGraph(
        funnelInstance.conversionContract as Prisma.JsonValue,
        funnelInstance.steps,
      );
      const node = graph.nodes[normalizedStepId];
      const currentStep = funnelInstance.steps.find((step) => step.id === normalizedStepId);

      if (!node || !currentStep) {
        throw new BadRequestException({
          code: 'FLOW_GRAPH_NODE_NOT_FOUND',
          message: 'stepId must exist in the FlowGraph.',
        });
      }

      const nextSlug =
        requestedSlug === undefined || requestedSlug === currentStep.slug
          ? currentStep.slug
          : requestedSlug === ''
            ? await this.reserveRootSlug(tx, funnelInstance.id, currentStep.id)
            : await this.createUniqueSlug(tx, funnelInstance.id, requestedSlug);

      if (nextSlug !== currentStep.slug) {
        await tx.funnelStep.update({
          where: { id: currentStep.id },
          data: {
            slug: nextSlug,
          },
        });
      }

      const nextGraph = {
        ...graph,
        nodes: {
          ...graph.nodes,
          [normalizedStepId]: {
            ...node,
            slug: nextSlug,
          },
        },
      };

      await this.persistGraph(tx, funnelInstance, nextGraph);

      return {
        funnelInstance,
        graph: nextGraph,
      };
    });

    return this.syncAndLint(result);
  }

  private addStepToGraph(graph: FlowGraphV1, node: FlowNode): FlowGraphV1 {
    return {
      ...graph,
      nodes: {
        ...graph.nodes,
        [node.stepId]: node,
      },
    };
  }

  private async updateGraph(
    scope: FunnelInstanceMutationScope,
    funnelInstanceId: string,
    mutate: (graph: FlowGraphV1) => FlowGraphV1,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const funnelInstance = await this.findFunnelInstanceForMutation(
        tx,
        scope,
        funnelInstanceId,
      );
      const graph = this.toFlowGraph(
        funnelInstance.conversionContract as Prisma.JsonValue,
        funnelInstance.steps,
      );
      const nextGraph = mutate(graph);

      await this.persistGraph(tx, funnelInstance, nextGraph);

      return {
        funnelInstance,
        graph: nextGraph,
      };
    });
  }

  private async findFunnelInstanceForMutation(
    tx: Prisma.TransactionClient,
    scope: FunnelInstanceMutationScope,
    funnelInstanceId: string,
  ) {
    const funnelInstance = await tx.funnelInstance.findFirst({
      where: {
        id: funnelInstanceId,
        workspaceId: scope.workspaceId,
        ...(scope.teamId ? { teamId: scope.teamId } : {}),
      },
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!funnelInstance) {
      throw new NotFoundException({
        code: 'FUNNEL_INSTANCE_NOT_FOUND',
        message: 'The requested funnel instance was not found.',
      });
    }

    return funnelInstance;
  }

  private async persistGraph(
    tx: Prisma.TransactionClient,
    funnelInstance: {
      id: string;
      conversionContract: Prisma.JsonValue;
    },
    graph: FlowGraphV1,
  ) {
    const conversionContract = {
      ...this.toJsonRecord(funnelInstance.conversionContract),
      flowGraph: graph,
    };

    await tx.funnelInstance.update({
      where: { id: funnelInstance.id },
      data: {
        conversionContract: toInputJson(conversionContract),
      },
    });
  }

  private async syncAndLint(result: {
    funnelInstance: {
      id: string;
      teamId: string;
      structuralType: string;
    };
    graph: FlowGraphV1;
  }): Promise<FlowGraphMutationResult> {
    await this.safeSyncRuntimeContext({
      tenantId: result.funnelInstance.teamId,
      funnelInstanceId: result.funnelInstance.id,
    });

    const report = lintFunnelDraft({
      blocksJson: [],
      structuralType: result.funnelInstance.structuralType,
      conversionContract: {
        flowGraph: result.graph,
      } as unknown as JsonValue,
    });

    return {
      ...report,
      graph: result.graph,
    };
  }

  private async safeSyncRuntimeContext(input: {
    tenantId: string;
    funnelInstanceId: string;
  }) {
    try {
      await this.runtimeContextConfigSyncService.syncFunnelContextForInstance(input);
    } catch (error) {
      this.logger.warn(
        `Runtime context sync skipped after graph mutation for tenant ${input.tenantId}, funnel ${input.funnelInstanceId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private toFlowGraph(
    conversionContract: Prisma.JsonValue | null | undefined,
    steps: Array<{
      id: string;
      slug: string;
      stepType: FunnelStepType;
      isEntryStep: boolean;
      isConversionStep: boolean;
    }>,
  ): FlowGraphV1 {
    const contract = this.toJsonRecord(conversionContract);
    const existingGraph = contract.flowGraph;

    if (this.isFlowGraph(existingGraph)) {
      return existingGraph;
    }

    const nodes = Object.fromEntries(
      steps.map((step) => [
        step.id,
        {
          stepId: step.id,
          slug: step.slug,
          stepType: step.stepType,
          role: this.roleFromStep(step),
          isTerminal: step.stepType === FunnelStepType.thank_you,
          exits: {},
        } satisfies FlowNode,
      ]),
    );

    return {
      version: 1,
      entryStepId: steps.find((step) => step.isEntryStep)?.id ?? steps[0]?.id ?? null,
      defaultOutcome: 'default',
      nodes,
    };
  }

  private isFlowGraph(value: unknown): value is FlowGraphV1 {
    return (
      isRecord(value) &&
      value.version === 1 &&
      (typeof value.entryStepId === 'string' || value.entryStepId === null) &&
      isRecord(value.nodes)
    );
  }

  private toJsonRecord(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, JsonValue> {
    return isRecord(value) ? (value as Record<string, JsonValue>) : {};
  }

  private async createUniqueSlug(
    tx: Prisma.TransactionClient,
    funnelInstanceId: string,
    baseSlug: string,
  ) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const existing = await tx.funnelStep.findFirst({
        where: {
          funnelInstanceId,
          slug,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return slug;
      }
    }

    throw new BadRequestException({
      code: 'FLOW_NODE_SLUG_CONFLICT',
      message: 'We could not generate a unique slug for this step.',
    });
  }

  private async reserveRootSlug(
    tx: Prisma.TransactionClient,
    funnelInstanceId: string,
    currentStepId: string,
  ) {
    const existing = await tx.funnelStep.findFirst({
      where: {
        funnelInstanceId,
        slug: '',
        id: {
          not: currentStepId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'FLOW_NODE_ROOT_SLUG_CONFLICT',
        message: 'Another step already owns the root path for this funnel.',
      });
    }

    return '';
  }

  private scopeFromUser(user: AuthenticatedUser): FunnelInstanceMutationScope {
    if (!user.workspaceId) {
      throw new BadRequestException({
        code: 'WORKSPACE_CONTEXT_REQUIRED',
        message: 'A workspace context is required to mutate a funnel graph.',
      });
    }

    return {
      workspaceId: user.workspaceId,
      teamId: user.role === UserRole.SUPER_ADMIN ? null : user.teamId,
    };
  }

  private normalizeStepId(value: string | null | undefined, field: string) {
    const normalized = value?.trim();

    if (!normalized) {
      throw new BadRequestException({
        code: 'FLOW_GRAPH_STEP_ID_REQUIRED',
        message: `${field} is required.`,
      });
    }

    return normalized;
  }

  private normalizeOutcome(value: string | null | undefined) {
    const normalized = value?.trim().toLowerCase();

    if (!normalized) {
      throw new BadRequestException({
        code: 'FLOW_GRAPH_OUTCOME_REQUIRED',
        message: 'An outcome is required to mutate a graph exit.',
      });
    }

    return normalized;
  }

  private normalizeRole(role: string | null | undefined) {
    const normalized = role?.trim().toLowerCase();

    if (!normalized) {
      throw new BadRequestException({
        code: 'FLOW_NODE_ROLE_REQUIRED',
        message: 'A role is required to add a step to the graph.',
      });
    }

    return normalized;
  }

  private normalizeTitle(
    title: string | null | undefined,
    role: string,
    templateKey: string | null | undefined,
  ) {
    const candidate = title?.trim() || templateKey?.trim() || role;

    return candidate
      .split(/[-_]+/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private normalizeStepType(
    value: string | null | undefined,
    role: string,
    templateKey: string | null | undefined,
  ): FunnelStepType {
    const candidate = (value ?? templateKey ?? role).trim().toLowerCase();
    const directMatch = Object.values(FunnelStepType).find(
      (stepType) => stepType === candidate,
    );

    if (directMatch) {
      return directMatch;
    }

    switch (role) {
      case FlowNodeRole.ENTRY:
        return FunnelStepType.vsl;
      case FlowNodeRole.CAPTURE:
        return FunnelStepType.lead_capture;
      case FlowNodeRole.THANK_YOU:
      case FlowNodeRole.TERMINAL:
        return FunnelStepType.thank_you;
      case FlowNodeRole.REDIRECT:
        return FunnelStepType.redirect;
      case FlowNodeRole.OFFER:
      case FlowNodeRole.UPSELL:
      case FlowNodeRole.DOWNSELL:
        return FunnelStepType.presentation;
      default:
        return FunnelStepType.presentation;
    }
  }

  private roleFromStep(step: {
    stepType: FunnelStepType;
    isEntryStep: boolean;
    isConversionStep: boolean;
  }) {
    if (step.isEntryStep) {
      return FlowNodeRole.ENTRY;
    }

    if (step.stepType === FunnelStepType.thank_you) {
      return FlowNodeRole.TERMINAL;
    }

    if (step.stepType === FunnelStepType.redirect) {
      return FlowNodeRole.REDIRECT;
    }

    return step.isConversionStep ? FlowNodeRole.OFFER : FlowNodeRole.CONTENT;
  }

  private isConversionRole(role: string) {
    return [
      FlowNodeRole.CAPTURE,
      FlowNodeRole.OFFER,
      FlowNodeRole.UPSELL,
      FlowNodeRole.DOWNSELL,
      FlowNodeRole.REDIRECT,
    ].includes(role as FlowNodeRole);
  }

  private isTerminalRole(role: string) {
    return [FlowNodeRole.THANK_YOU, FlowNodeRole.TERMINAL].includes(
      role as FlowNodeRole,
    );
  }
}
