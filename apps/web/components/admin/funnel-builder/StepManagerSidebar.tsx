"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  Link2,
  Plus,
  Sparkles,
  ShieldCheck,
  Trash2,
  Zap,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  lintFunnelDraft,
  type FlowNode,
  type FlowGraphV1,
  type FunnelLintIssue,
  type FunnelRuntimeHealthStatus,
  type JsonValue,
  FlowNodeRole,
  FlowOutcome,
} from "../../../../../packages/shared/funnel-lint/src";
import { StepCard } from "@/components/admin/funnel-builder/StepCard";
import { teamOperationRequest } from "@/lib/team-operations";

type StepManagerSidebarProps = {
  funnelInstanceId?: string | null;
  graph?: FlowGraphV1 | null;
  runtimeHealthStatus?: FunnelRuntimeHealthStatus;
  isOrchestrating?: boolean;
  onSmartWiring?: () => void;
  onActiveStepChange?: (stepId: string, node: FlowNode, orderIndex: number) => void;
  onGraphUpdated?: (graph: FlowGraphV1) => void;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const addableRoleOptions = [
  {
    role: FlowNodeRole.OFFER,
    label: "Offer",
    templateKey: "oto",
  },
  {
    role: FlowNodeRole.UPSELL,
    label: "Upsell",
    templateKey: "oto",
  },
  {
    role: FlowNodeRole.DOWNSELL,
    label: "Downsell",
    templateKey: "oto",
  },
  {
    role: FlowNodeRole.THANK_YOU,
    label: "Thank You",
    templateKey: "thank_you",
  },
] as const;

const quickOutcomeOptions = [
  {
    value: FlowOutcome.DEFAULT,
    label: "Default",
  },
  {
    value: FlowOutcome.SUBMIT_SUCCESS,
    label: "Éxito",
  },
  {
    value: FlowOutcome.DECLINE,
    label: "Rechazo",
  },
  {
    value: FlowOutcome.ACCEPT,
    label: "Acepta",
  },
] as const;

const blueprintOptions = [
  {
    type: "LEAD_MAGNET",
    icon: "📦",
    title: "Captura de Leads",
    description: "Landing + Gracias",
  },
  {
    type: "DIRECT_SALE",
    icon: "💰",
    title: "Venta Directa",
    description: "Landing + Oferta + Gracias",
  },
  {
    type: "VSL_FUNNEL",
    icon: "🎥",
    title: "VSL Funnel",
    description: "Video + Oferta + Registro",
  },
] as const;

const statusConfig: Record<
  FunnelRuntimeHealthStatus,
  {
    label: string;
    icon: LucideIcon;
    className: string;
  }
> = {
  healthy: {
    label: "Healthy",
    icon: ShieldCheck,
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  broken: {
    label: "Broken",
    icon: XCircle,
    className:
      "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

const createEmptyReport = (): ReturnType<typeof lintFunnelDraft> => ({
  status: "healthy",
  issues: [],
  appliedFixes: [],
});

const getOrderedNodes = (graph: FlowGraphV1 | null) => {
  if (!graph) {
    return [];
  }

  const explicitOrder = (
    graph as unknown as {
      stepOrder?: string[];
    }
  ).stepOrder;

  const orderedStepIds =
    Array.isArray(explicitOrder) && explicitOrder.length > 0
      ? explicitOrder
      : Object.keys(graph.nodes);

  const orderedNodes = orderedStepIds
    .map((stepId) => graph.nodes[stepId])
    .filter((node): node is FlowNode => Boolean(node));

  const orderedSet = new Set(orderedNodes.map((node) => node.stepId));
  const remainingNodes = Object.values(graph.nodes).filter(
    (node) => !orderedSet.has(node.stepId),
  );

  return [...orderedNodes, ...remainingNodes];
};

const getIssuesForStep = (issues: FunnelLintIssue[], stepId: string) =>
  issues.filter(
    (issue) => issue.stepId === stepId || issue.targetStepId === stepId,
  );

const buildConnectionSummary = (
  node: FlowNode,
  graph: FlowGraphV1 | null,
) => {
  const exits = Object.values(node.exits ?? {});

  if (!graph || exits.length === 0) {
    return null;
  }

  return exits
    .map((exit) => {
      const targetNode = graph.nodes[exit.toStepId];
      const targetLabel =
        targetNode?.meta?.title?.trim() || targetNode?.slug || exit.toStepId;
      const outcomeLabel =
        exit.outcome === FlowOutcome.DEFAULT ? "default" : String(exit.outcome);

      return `${outcomeLabel} -> ${targetLabel}`;
    })
    .join(" · ");
};

const dispatchActiveStepChange = (
  stepId: string,
  node: FlowNode,
  orderIndex: number,
) => {
  window.dispatchEvent(
    new CustomEvent("leadflow:step-manager:active-step-change", {
      detail: {
        stepId,
        node,
        orderIndex,
      },
    }),
  );
};

export function StepManagerSidebar({
  funnelInstanceId,
  graph,
  runtimeHealthStatus,
  isOrchestrating = false,
  onSmartWiring,
  onActiveStepChange,
  onGraphUpdated,
}: StepManagerSidebarProps) {
  const [localGraph, setLocalGraph] = useState<FlowGraphV1 | null>(graph ?? null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isBlueprintMenuOpen, setIsBlueprintMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingSlugs, setEditingSlugs] = useState<Record<string, string>>({});
  const [savingSlugStepId, setSavingSlugStepId] = useState<string | null>(null);
  const [focusedSlugStepId, setFocusedSlugStepId] = useState<string | null>(null);
  const [dirtySlugStepIds, setDirtySlugStepIds] = useState<Record<string, true>>({});
  const [selectedOutcomes, setSelectedOutcomes] = useState<Record<string, string>>(
    {},
  );
  const [isPending, startTransition] = useTransition();
  const [isSlugPending, startSlugTransition] = useTransition();
  const orderedNodes = useMemo(() => getOrderedNodes(localGraph), [localGraph]);
  const stepManagerReport = useMemo(
    () =>
      localGraph
        ? lintFunnelDraft({
            blocksJson: [],
            structuralType: "multi_step_conversion",
            conversionContract: {
              flowGraph: localGraph,
            } as unknown as JsonValue,
          })
        : createEmptyReport(),
    [localGraph],
  );
  const [activeStepId, setActiveStepId] = useState(
    localGraph?.entryStepId ?? orderedNodes[0]?.stepId ?? "",
  );
  const status = runtimeHealthStatus ?? stepManagerReport.status;
  const StatusIcon = statusConfig[status].icon;
  const issueCount = stepManagerReport.issues.length;
  const errorCount = stepManagerReport.issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const orphanStepIds = useMemo(
    () =>
      new Set(
        stepManagerReport.issues
          .filter((issue) => issue.code === "ORPHAN_STEP" && issue.stepId)
          .map((issue) => issue.stepId as string),
      ),
    [stepManagerReport.issues],
  );

  const applyGraphResponse = (response: { graph: FlowGraphV1 }) => {
    setLocalGraph(response.graph);
    setEditingSlugs((current) => {
      const next = { ...current };

      for (const node of Object.values(response.graph.nodes)) {
        if (focusedSlugStepId === node.stepId && dirtySlugStepIds[node.stepId]) {
          continue;
        }

        next[node.stepId] = node.slug;
      }

      return next;
    });
    onGraphUpdated?.(response.graph);
  };

  const handleSelectNode = (node: FlowNode, orderIndex: number) => {
    setActiveStepId(node.stepId);
    onActiveStepChange?.(node.stepId, node, orderIndex);
    dispatchActiveStepChange(node.stepId, node, orderIndex);
  };

  const handleAddNode = (option: (typeof addableRoleOptions)[number]) => {
    if (!funnelInstanceId) {
      setErrorMessage("No hay funnelInstanceId disponible para crear pasos.");
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const response = await teamOperationRequest<{
          graph: FlowGraphV1;
        }>(`/funnel-instances/${encodeURIComponent(funnelInstanceId)}/graph/nodes`, {
          method: "POST",
          body: JSON.stringify({
            role: option.role,
            title: `Nuevo ${option.label}`,
            templateKey: option.templateKey,
            isTerminal: option.role === FlowNodeRole.THANK_YOU,
          }),
        });

        applyGraphResponse(response);
        setIsAddMenuOpen(false);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos añadir el paso al grafo.",
        );
      }
    });
  };

  const handleConnectToPrevious = (node: FlowNode, index: number) => {
    const previousNode = orderedNodes[index - 1];

    if (!funnelInstanceId || !previousNode) {
      return;
    }

    const outcome = selectedOutcomes[node.stepId] ?? FlowOutcome.DEFAULT;

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const response = await teamOperationRequest<{
          graph: FlowGraphV1;
        }>(`/funnel-instances/${encodeURIComponent(funnelInstanceId)}/graph/edges`, {
          method: "PATCH",
          body: JSON.stringify({
            fromStepId: previousNode.stepId,
            toStepId: node.stepId,
            outcome,
            label: `Conectar a ${node.meta?.title ?? node.slug}`,
          }),
        });

        applyGraphResponse(response);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos conectar los pasos.",
        );
      }
    });
  };

  const handleRemoveNode = (node: FlowNode) => {
    if (!funnelInstanceId) {
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const response = await teamOperationRequest<{
          graph: FlowGraphV1;
        }>(
          `/funnel-instances/${encodeURIComponent(
            funnelInstanceId,
          )}/graph/nodes/${encodeURIComponent(node.stepId)}`,
          {
            method: "DELETE",
          },
        );

        applyGraphResponse(response);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos borrar el paso del grafo.",
        );
      }
    });
  };

  const handleApplyBlueprint = (
    blueprint: (typeof blueprintOptions)[number],
  ) => {
    if (!funnelInstanceId) {
      setErrorMessage("No hay funnelInstanceId disponible para aplicar un blueprint.");
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const response = await teamOperationRequest<{
          graph: FlowGraphV1;
        }>(`/funnels/${encodeURIComponent(funnelInstanceId)}/apply-blueprint`, {
          method: "POST",
          body: JSON.stringify({
            type: blueprint.type,
            mode:
              localGraph && Object.keys(localGraph.nodes).length > 0
                ? "merge"
                : "replace",
          }),
        });

        applyGraphResponse(response);
        setIsBlueprintMenuOpen(false);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos aplicar el sistema listo.",
        );
      }
    });
  };

  const handleSlugSave = (node: FlowNode) => {
    if (!funnelInstanceId) {
      return;
    }

    const nextSlug = (editingSlugs[node.stepId] ?? node.slug)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-");

    if (nextSlug === node.slug) {
      setEditingSlugs((current) => ({
        ...current,
        [node.stepId]: node.slug,
      }));
      setDirtySlugStepIds((current) => {
        const next = { ...current };
        delete next[node.stepId];
        return next;
      });
      return;
    }

    setSavingSlugStepId(node.stepId);
    setErrorMessage(null);
    startSlugTransition(async () => {
      try {
        const response = await teamOperationRequest<{
          graph: FlowGraphV1;
        }>(
          `/funnel-instances/${encodeURIComponent(
            funnelInstanceId,
          )}/graph/nodes/${encodeURIComponent(node.stepId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              slug: nextSlug,
            }),
          },
        );

        applyGraphResponse(response);
        setDirtySlugStepIds((current) => {
          const next = { ...current };
          delete next[node.stepId];
          return next;
        });
      } catch (error) {
        setEditingSlugs((current) => ({
          ...current,
          [node.stepId]: node.slug,
        }));
        setDirtySlugStepIds((current) => {
          const next = { ...current };
          delete next[node.stepId];
          return next;
        });
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos actualizar el slug del paso.",
        );
      } finally {
        setSavingSlugStepId(null);
      }
    });
  };

  useEffect(() => {
    setLocalGraph(graph ?? null);
  }, [graph]);

  useEffect(() => {
    if (!graph) {
      setEditingSlugs({});
      setDirtySlugStepIds({});
      return;
    }

    setEditingSlugs((current) => {
      const next = { ...current };

      for (const node of Object.values(graph.nodes)) {
        if (focusedSlugStepId === node.stepId && dirtySlugStepIds[node.stepId]) {
          continue;
        }

        next[node.stepId] = node.slug;
      }

      return next;
    });
  }, [dirtySlugStepIds, focusedSlugStepId, graph]);

  useEffect(() => {
    setActiveStepId((current) => {
      if (current && orderedNodes.some((node) => node.stepId === current)) {
        return current;
      }

      return localGraph?.entryStepId ?? orderedNodes[0]?.stepId ?? "";
    });
  }, [localGraph?.entryStepId, orderedNodes]);

  return (
    <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/90 shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50 dark:shadow-slate-950/30">
      <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-3 dark:border-white/10 dark:bg-slate-950/50">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Flow Director
            </p>
            <h2 className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              FlowGraph vivo
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBlueprintMenuOpen((current) => !current)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-amber-400 hover:text-amber-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-amber-500/40 dark:hover:text-amber-300"
              aria-label="Abrir blueprints"
              title="Abrir blueprints"
            >
              <Zap className="h-4 w-4" />
            </button>
            <span
              className={cx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                statusConfig[status].className,
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {statusConfig[status].label}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-slate-200 bg-white px-2 py-2 dark:border-white/10 dark:bg-slate-800/80">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {orderedNodes.length}
            </p>
            <p className="mt-0.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Pasos
            </p>
          </div>
          <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-2">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{errorCount}</p>
            <p className="mt-0.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-red-700/80 dark:text-red-300/80">
              Errores
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-2 py-2 dark:border-white/10 dark:bg-slate-800/80">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{issueCount}</p>
            <p className="mt-0.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Issues
            </p>
          </div>
        </div>

        {isBlueprintMenuOpen ? (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900/90">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Sistemas listos
            </p>
            {blueprintOptions.map((blueprint) => (
              <button
                key={blueprint.type}
                type="button"
                onClick={() => handleApplyBlueprint(blueprint)}
                disabled={isPending}
                className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50 dark:border-white/10 dark:bg-slate-800 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800/90"
              >
                <span className="text-lg">{blueprint.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {blueprint.title}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {blueprint.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative mt-3 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsAddMenuOpen((isOpen) => !isOpen)}
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-cyan-100 dark:hover:bg-cyan-500/20"
            >
              <Plus className="h-3.5 w-3.5" />
              {isPending ? "Añadiendo..." : "Añadir Paso"}
            </button>
            <button
              type="button"
              onClick={onSmartWiring}
              disabled={isOrchestrating || !onSmartWiring}
              className={cx(
                "inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                isOrchestrating
                  ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-700 shadow-[0_0_28px_rgba(217,70,239,0.28)] dark:text-fuchsia-100"
                  : "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-700 hover:bg-fuchsia-500/15 dark:text-fuchsia-100 dark:hover:bg-fuchsia-500/20",
              )}
            >
              <Sparkles
                className={cx("h-3.5 w-3.5", isOrchestrating && "animate-pulse")}
              />
              {isOrchestrating ? "Cableando..." : "Smart Wiring"}
            </button>
          </div>

          {isAddMenuOpen ? (
            <div className="absolute left-0 right-0 top-11 z-20 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-200/50 dark:border-white/10 dark:bg-slate-900 dark:shadow-slate-950/40">
              {addableRoleOptions.map((option) => (
                <button
                  key={option.role}
                  type="button"
                  onClick={() => handleAddNode(option)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <span>{option.label}</span>
                  <span className="text-[0.65rem] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
                    {option.templateKey}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {errorMessage ? (
          <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-700 dark:text-red-300">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {orderedNodes.length > 0 ? (
          <ol className="space-y-2">
          {orderedNodes.map((node, index) => {
            const isOrphan = orphanStepIds.has(node.stepId);
            const canConnectToPrevious = isOrphan && index > 0;
            const canRemove =
              localGraph?.entryStepId !== node.stepId &&
              node.role !== FlowNodeRole.ENTRY;

            return (
            <li key={node.stepId} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <span className="pt-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-500">
                {index + 1}
              </span>
              <div className="min-w-0">
                <div
                  role="button"
                  tabIndex={0}
                  className="block w-full cursor-pointer text-left"
                  onClick={() => handleSelectNode(node, index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleSelectNode(node, index);
                    }
                  }}
                >
                  <StepCard
                    node={node}
                    issues={getIssuesForStep(stepManagerReport.issues, node.stepId)}
                    isActive={activeStepId === node.stepId}
                    connectionSummary={buildConnectionSummary(node, localGraph)}
                    slugEditor={
                      <div
                        className="flex items-center gap-2"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <span className="text-xs text-slate-500 dark:text-slate-500">/</span>
                        <input
                          value={editingSlugs[node.stepId] ?? node.slug}
                          onFocus={() => setFocusedSlugStepId(node.stepId)}
                          onChange={(event) => {
                            const normalizedValue = event.target.value
                              .toLowerCase()
                              .trim()
                              .replace(/\s+/g, "-");

                            setEditingSlugs((current) => ({
                              ...current,
                              [node.stepId]: normalizedValue,
                            }));
                            setDirtySlugStepIds((current) => ({
                              ...current,
                              [node.stepId]: true,
                            }));
                          }}
                          placeholder="slug o vacío"
                          onBlur={() => {
                            setFocusedSlugStepId((current) =>
                              current === node.stepId ? null : current,
                            );
                            handleSlugSave(node);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleSlugSave(node);
                              return;
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              setEditingSlugs((current) => ({
                                ...current,
                                [node.stepId]: node.slug,
                              }));
                              setDirtySlugStepIds((current) => {
                                const next = { ...current };
                                delete next[node.stepId];
                                return next;
                              });
                              setFocusedSlugStepId((current) =>
                                current === node.stepId ? null : current,
                              );
                            }
                          }}
                          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-cyan-400/50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                        />
                        {savingSlugStepId === node.stepId ||
                        (isSlugPending && focusedSlugStepId === node.stepId) ? (
                          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-cyan-300">
                            Guardando
                          </span>
                        ) : null}
                      </div>
                    }
                  />
                </div>

                {(canConnectToPrevious || canRemove) ? (
                  <div className="mt-1.5 rounded-lg border border-slate-200 bg-white/90 p-2 shadow-lg shadow-slate-200/50 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-slate-950/20">
                    {canConnectToPrevious ? (
                      <div className="grid gap-2">
                        <label className="grid gap-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          Outcome
                          <select
                            value={selectedOutcomes[node.stepId] ?? FlowOutcome.DEFAULT}
                            onChange={(event) =>
                              setSelectedOutcomes((current) => ({
                                ...current,
                                [node.stepId]: event.target.value,
                              }))
                            }
                            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-400/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {quickOutcomeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleConnectToPrevious(node, index)}
                          disabled={isPending}
                          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500/90 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Conectar al paso anterior
                        </button>
                      </div>
                    ) : null}

                    {canRemove ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveNode(node)}
                        disabled={isPending}
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-xs font-semibold text-red-300 transition hover:border-red-500/30 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Borrar paso
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
            );
          })}
          </ol>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 py-6 text-center dark:border-white/10 dark:bg-slate-900/70">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Sin grafo todavía
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Elige un sistema listo para crear los pasos y el cableado
              inicial en automático.
            </p>

            <div className="mt-4 grid gap-2 text-left">
              {blueprintOptions.map((blueprint) => (
                <button
                  key={blueprint.type}
                  type="button"
                  onClick={() => handleApplyBlueprint(blueprint)}
                  disabled={isPending || !funnelInstanceId}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-800/90 dark:hover:border-cyan-400/30 dark:hover:bg-slate-800"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg leading-none">{blueprint.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {blueprint.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {blueprint.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
          <Activity className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300/80" />
          <span className="truncate">Grafo real conectado a FunnelInstance</span>
        </div>
      </div>
    </aside>
  );
}
