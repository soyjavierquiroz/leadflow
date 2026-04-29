import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FunnelStepType, Prisma, UserRole } from '@prisma/client';
import {
  FlowNodeRole,
  FlowOutcome,
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

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

type BlueprintType = 'LEAD_MAGNET' | 'DIRECT_SALE' | 'VSL_FUNNEL';

type BlueprintStepDefinition = {
  key: string;
  title: string;
  slug: string;
  stepType: FunnelStepType;
  role: FlowNodeRole;
  templateKey: string;
  isEntry?: boolean;
  isTerminal?: boolean;
};

type BlueprintEdgeDefinition = {
  fromKey: string;
  toKey: string;
  outcome: FlowOutcome;
  label?: string;
};

type BlueprintDefinition = {
  type: BlueprintType;
  label: string;
  structuralType: 'two_step_conversion' | 'multi_step_conversion';
  steps: BlueprintStepDefinition[];
  edges: BlueprintEdgeDefinition[];
};

type BlueprintMutationScope = {
  workspaceId: string;
  teamId?: string | null;
};

type ApplyBlueprintResult = FunnelLintReport & {
  blueprintType: BlueprintType;
  graph: FlowGraphV1;
  steps: Array<{
    id: string;
    slug: string;
    stepType: FunnelStepType;
    position: number;
    role: FlowNodeRole;
  }>;
};

const BLUEPRINTS: Record<BlueprintType, BlueprintDefinition> = {
  LEAD_MAGNET: {
    type: 'LEAD_MAGNET',
    label: 'Captura de Leads',
    structuralType: 'two_step_conversion',
    steps: [
      {
        key: 'landing',
        title: 'Landing de Captura',
        slug: 'captura',
        stepType: FunnelStepType.landing,
        role: FlowNodeRole.ENTRY,
        templateKey: 'landing',
        isEntry: true,
      },
      {
        key: 'thank_you',
        title: 'Gracias',
        slug: 'gracias',
        stepType: FunnelStepType.thank_you,
        role: FlowNodeRole.THANK_YOU,
        templateKey: 'thank_you',
        isTerminal: true,
      },
    ],
    edges: [
      {
        fromKey: 'landing',
        toKey: 'thank_you',
        outcome: FlowOutcome.SUBMIT_SUCCESS,
        label: 'Formulario completado',
      },
    ],
  },
  DIRECT_SALE: {
    type: 'DIRECT_SALE',
    label: 'Venta Directa',
    structuralType: 'multi_step_conversion',
    steps: [
      {
        key: 'landing',
        title: 'Landing de Oferta',
        slug: 'captura',
        stepType: FunnelStepType.landing,
        role: FlowNodeRole.ENTRY,
        templateKey: 'landing',
        isEntry: true,
      },
      {
        key: 'offer',
        title: 'Oferta Principal',
        slug: 'oferta',
        stepType: FunnelStepType.presentation,
        role: FlowNodeRole.OFFER,
        templateKey: 'oto',
      },
      {
        key: 'thank_you',
        title: 'Gracias',
        slug: 'gracias',
        stepType: FunnelStepType.thank_you,
        role: FlowNodeRole.THANK_YOU,
        templateKey: 'thank_you',
        isTerminal: true,
      },
    ],
    edges: [
      {
        fromKey: 'landing',
        toKey: 'offer',
        outcome: FlowOutcome.SUBMIT_SUCCESS,
        label: 'Lead capturado',
      },
      {
        fromKey: 'offer',
        toKey: 'thank_you',
        outcome: FlowOutcome.ACCEPT,
        label: 'Compra aceptada',
      },
    ],
  },
  VSL_FUNNEL: {
    type: 'VSL_FUNNEL',
    label: 'VSL Funnel',
    structuralType: 'multi_step_conversion',
    steps: [
      {
        key: 'video',
        title: 'VSL Principal',
        slug: 'vsl',
        stepType: FunnelStepType.vsl,
        role: FlowNodeRole.ENTRY,
        templateKey: 'vsl',
        isEntry: true,
      },
      {
        key: 'offer',
        title: 'Oferta',
        slug: 'oferta',
        stepType: FunnelStepType.presentation,
        role: FlowNodeRole.OFFER,
        templateKey: 'oto',
      },
      {
        key: 'registration',
        title: 'Registro',
        slug: 'registro',
        stepType: FunnelStepType.lead_capture,
        role: FlowNodeRole.CAPTURE,
        templateKey: 'lead_capture',
        isTerminal: true,
      },
    ],
    edges: [
      {
        fromKey: 'video',
        toKey: 'offer',
        outcome: FlowOutcome.DEFAULT,
        label: 'Continuar a oferta',
      },
      {
        fromKey: 'offer',
        toKey: 'registration',
        outcome: FlowOutcome.ACCEPT,
        label: 'Ir al registro',
      },
    ],
  },
};

@Injectable()
export class BlueprintService {
  private readonly logger = new Logger(BlueprintService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: TemplateService,
    private readonly runtimeContextConfigSyncService: RuntimeContextConfigSyncService,
  ) {}

  async applyBlueprintForUser(
    user: AuthenticatedUser,
    funnelInstanceId: string,
    type: string,
    mode?: 'replace' | 'merge',
  ): Promise<ApplyBlueprintResult> {
    if (!user.workspaceId) {
      throw new BadRequestException({
        code: 'WORKSPACE_CONTEXT_REQUIRED',
        message: 'A workspace context is required to apply a blueprint.',
      });
    }

    return this.applyBlueprint(
      {
        workspaceId: user.workspaceId,
        teamId: user.role === UserRole.SUPER_ADMIN ? null : user.teamId,
      },
      funnelInstanceId,
      type,
      mode,
    );
  }

  async applyBlueprint(
    scope: BlueprintMutationScope,
    funnelInstanceId: string,
    type: string,
    mode: 'replace' | 'merge' = 'replace',
  ): Promise<ApplyBlueprintResult> {
    const blueprint = this.resolveBlueprint(type);

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

      if (mode === 'replace' && funnelInstance.steps.length > 0) {
        throw new ConflictException({
          code: 'FUNNEL_BLUEPRINT_REQUIRES_EMPTY_GRAPH',
          message:
            'Blueprints can only be applied to funnel instances without steps.',
        });
      }

      const existingGraph = this.toFlowGraph(
        funnelInstance.conversionContract as Prisma.JsonValue,
        funnelInstance.steps,
      );
      const usedExistingNodeIds = new Set<string>();
      const createdSteps: Array<{
        key: string;
        id: string;
        slug: string;
        stepType: FunnelStepType;
        position: number;
        role: FlowNodeRole;
      }> = [];

      const stepByKey = new Map<
        string,
        {
          key: string;
          id: string;
          slug: string;
          stepType: FunnelStepType;
          position: number;
          role: FlowNodeRole;
        }
      >();

      const reserveExistingStep = (stepDefinition: BlueprintStepDefinition) => {
        const availableSteps = funnelInstance.steps.filter(
          (step) => !usedExistingNodeIds.has(step.id),
        );

        const matchedStep =
          (stepDefinition.isEntry
            ? availableSteps.find((step) => step.isEntryStep) ?? availableSteps[0]
            : availableSteps.find(
                (step) =>
                  existingGraph.nodes[step.id]?.role === stepDefinition.role ||
                  step.stepType === stepDefinition.stepType ||
                  step.slug === stepDefinition.slug,
              )) ?? null;

        if (!matchedStep) {
          return null;
        }

        usedExistingNodeIds.add(matchedStep.id);

        const reserved = {
          key: stepDefinition.key,
          id: matchedStep.id,
          slug: matchedStep.slug,
          stepType: matchedStep.stepType,
          position: matchedStep.position,
          role:
            (existingGraph.nodes[matchedStep.id]?.role as FlowNodeRole | undefined) ??
            stepDefinition.role,
        };

        createdSteps.push(reserved);
        stepByKey.set(stepDefinition.key, reserved);
        return reserved;
      };

      for (const [index, stepDefinition] of blueprint.steps.entries()) {
        if (mode === 'merge' && reserveExistingStep(stepDefinition)) {
          continue;
        }

        const defaults = await this.templateService.getStepDefaults({
          workspaceId: funnelInstance.workspaceId,
          templateKey: stepDefinition.templateKey,
          stepType: stepDefinition.stepType,
        });

        const slug = await this.createUniqueSlug(
          tx,
          funnelInstance.id,
          slugify(stepDefinition.slug),
        );
        const position = index + 1;
        const step = await tx.funnelStep.create({
          data: {
            workspaceId: funnelInstance.workspaceId,
            teamId: funnelInstance.teamId,
            funnelInstanceId: funnelInstance.id,
            stepType: stepDefinition.stepType,
            slug,
            position,
            isEntryStep: Boolean(stepDefinition.isEntry),
            isConversionStep: this.isConversionRole(stepDefinition.role),
            blocksJson: toInputJson(defaults.blocksJson),
            mediaMap: toInputJson(defaults.mediaMap),
            settingsJson: toInputJson(defaults.settingsJson),
          },
        });

        createdSteps.push({
          key: stepDefinition.key,
          id: step.id,
          slug: step.slug,
          stepType: step.stepType,
          position: step.position,
          role: stepDefinition.role,
        });
        stepByKey.set(stepDefinition.key, {
          key: stepDefinition.key,
          id: step.id,
          slug: step.slug,
          stepType: step.stepType,
          position: step.position,
          role: stepDefinition.role,
        });
      }

      const nodes: Record<string, FlowNode> =
        mode === 'merge' ? { ...existingGraph.nodes } : {};

      for (const stepDefinition of blueprint.steps) {
        const createdStep = stepByKey.get(stepDefinition.key);

        if (!createdStep) {
          throw new BadRequestException({
            code: 'FUNNEL_BLUEPRINT_STEP_RESOLUTION_FAILED',
            message: `Unable to resolve the step for blueprint key ${stepDefinition.key}.`,
          });
        }

        const existingNode = nodes[createdStep.id];
        nodes[createdStep.id] = {
          stepId: createdStep.id,
          slug: createdStep.slug,
          stepType: createdStep.stepType,
          role: stepDefinition.role,
          isTerminal: stepDefinition.isTerminal ?? existingNode?.isTerminal ?? false,
          meta: {
            ...existingNode?.meta,
            title: existingNode?.meta?.title ?? stepDefinition.title,
          },
          exits: existingNode?.exits ?? {},
        };
      }

      for (const edge of blueprint.edges) {
        const fromStep = stepByKey.get(edge.fromKey);
        const toStep = stepByKey.get(edge.toKey);

        if (!fromStep || !toStep) {
          throw new BadRequestException({
            code: 'FUNNEL_BLUEPRINT_EDGE_RESOLUTION_FAILED',
            message: `Unable to resolve blueprint edge ${edge.fromKey} -> ${edge.toKey}.`,
          });
        }

        const exit: FlowExit = {
          outcome: edge.outcome,
          toStepId: toStep.id,
          label: edge.label,
        };

        nodes[fromStep.id].exits[edge.outcome] =
          nodes[fromStep.id].exits[edge.outcome] ?? exit;
      }

      const graph = {
        version: 1 as const,
        entryStepId: (
          stepByKey.get(
            blueprint.steps.find((step) => step.isEntry)?.key ?? '',
          )?.id ??
          existingGraph.entryStepId ??
          createdSteps.find((step) =>
            blueprint.steps.find(
              (item) => item.key === step.key && item.isEntry,
            ),
          )?.id ??
          createdSteps[0]?.id ??
          null
        ),
        defaultOutcome: FlowOutcome.DEFAULT,
        nodes,
        stepOrder:
          mode === 'merge'
            ? [
                ...funnelInstance.steps.map((step) => step.id),
                ...createdSteps
                  .filter(
                    (step) =>
                      !funnelInstance.steps.some(
                        (existingStep) => existingStep.id === step.id,
                      ),
                  )
                  .map((step) => step.id),
              ]
            : createdSteps.map((step) => step.id),
      } as unknown as FlowGraphV1;

      const existingContract =
        (funnelInstance.conversionContract as Record<string, unknown> | null) ?? {};

      await tx.funnelInstance.update({
        where: { id: funnelInstance.id },
        data: {
          structuralType: blueprint.structuralType,
          conversionContract: toInputJson({
            ...existingContract,
            blueprintType: blueprint.type,
            blueprintMode: mode,
            flowGraph: graph,
          }),
        },
      });

      return {
        funnelInstance,
        graph,
        steps: createdSteps,
      };
    });

    await this.safeSyncRuntimeContext({
      tenantId: result.funnelInstance.teamId,
      funnelInstanceId: result.funnelInstance.id,
    });

    const report = lintFunnelDraft({
      blocksJson: [],
      structuralType: blueprint.structuralType,
      conversionContract: {
        flowGraph: result.graph,
      } as unknown as JsonValue,
    });

    return {
      ...report,
      blueprintType: blueprint.type,
      graph: result.graph,
      steps: result.steps.map((step) => ({
        id: step.id,
        slug: step.slug,
        stepType: step.stepType,
        position: step.position,
        role: step.role,
      })),
    };
  }

  private resolveBlueprint(type: string): BlueprintDefinition {
    const normalized = type.trim().toUpperCase() as BlueprintType;
    const blueprint = BLUEPRINTS[normalized];

    if (!blueprint) {
      throw new BadRequestException({
        code: 'FUNNEL_BLUEPRINT_UNKNOWN',
        message: `The blueprint type "${type}" is not supported.`,
      });
    }

    return blueprint;
  }

  private async createUniqueSlug(
    tx: Prisma.TransactionClient,
    funnelInstanceId: string,
    requestedSlug: string,
  ) {
    const baseSlug = requestedSlug || 'step';

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const existing = await tx.funnelStep.findFirst({
        where: {
          funnelInstanceId,
          slug,
        },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }
    }

    throw new ConflictException({
      code: 'FLOW_NODE_SLUG_CONFLICT',
      message: 'Unable to reserve a unique slug for the generated blueprint step.',
    });
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
    const contract = isRecord(conversionContract)
      ? (conversionContract as Record<string, unknown>)
      : {};
    const existingGraph = contract.flowGraph;

    if (
      isRecord(existingGraph) &&
      existingGraph.version === 1 &&
      (typeof existingGraph.entryStepId === 'string' ||
        existingGraph.entryStepId === null) &&
      isRecord(existingGraph.nodes)
    ) {
      return existingGraph as unknown as FlowGraphV1;
    }

    const nodes = Object.fromEntries(
      steps.map((step) => [
        step.id,
        {
          stepId: step.id,
          slug: step.slug,
          stepType: step.stepType,
          role: step.isEntryStep
            ? FlowNodeRole.ENTRY
            : step.stepType === FunnelStepType.thank_you
              ? FlowNodeRole.THANK_YOU
              : step.isConversionStep
                ? FlowNodeRole.OFFER
                : FlowNodeRole.CONTENT,
          isTerminal: step.stepType === FunnelStepType.thank_you,
          exits: {},
        } satisfies FlowNode,
      ]),
    );

    return {
      version: 1,
      entryStepId: steps.find((step) => step.isEntryStep)?.id ?? steps[0]?.id ?? null,
      defaultOutcome: FlowOutcome.DEFAULT,
      nodes,
    };
  }

  private isConversionRole(role: FlowNodeRole) {
    return (
      role === FlowNodeRole.ENTRY ||
      role === FlowNodeRole.CAPTURE ||
      role === FlowNodeRole.OFFER ||
      role === FlowNodeRole.UPSELL ||
      role === FlowNodeRole.DOWNSELL
    );
  }

  private async safeSyncRuntimeContext(input: {
    tenantId: string;
    funnelInstanceId: string;
  }) {
    try {
      await this.runtimeContextConfigSyncService.syncFunnelContextForInstance(
        input,
      );
    } catch (error) {
      this.logger.warn(
        `Runtime context sync skipped after blueprint apply for tenant ${input.tenantId}, funnel ${input.funnelInstanceId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
