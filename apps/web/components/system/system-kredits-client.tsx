"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { RefreshCw, Search, Wallet } from "lucide-react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type {
  SystemKreditDirectoryRow,
  SystemKreditInjectionRequest,
  SystemKreditInjectionResponse,
} from "@/lib/system-kredits";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type SystemKreditsClientProps = {
  initialRows: SystemKreditDirectoryRow[];
};

type ToastState = {
  title: string;
  description: string | null;
};

type InjectionFormState = {
  targetType: "team" | "sponsor";
  targetId: string;
  amountDecimal: string;
  reason: string;
  note: string;
  confirmationChecked: boolean;
};

type InjectionFormErrors = Partial<
  Record<"targetId" | "amountDecimal" | "reason", string>
>;

const primaryButtonClassName =
  "rounded-full bg-app-text px-4 py-2 text-sm font-semibold text-app-bg transition hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-app-border bg-app-card px-4 py-2 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";

const amountPattern = /^\d+(?:\.\d{0,6})?$/;

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const formatKredits = (value: string) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(parsed);
};

const buildInitialFormState = (
  row?: SystemKreditDirectoryRow,
): InjectionFormState => ({
  targetType: row ? "sponsor" : "sponsor",
  targetId: row?.sponsorId ?? "",
  amountDecimal: "",
  reason: "",
  note: "",
  confirmationChecked: false,
});

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
};

const validateForm = (
  state: InjectionFormState,
  availableTargetIds: Set<string>,
): InjectionFormErrors => {
  const errors: InjectionFormErrors = {};

  if (!state.targetId || !availableTargetIds.has(state.targetId)) {
    errors.targetId = "Selecciona un destino válido para la carga.";
  }

  const amountValue = normalizeText(state.amountDecimal);

  if (!amountValue) {
    errors.amountDecimal = "Ingresa un monto para continuar.";
  } else if (!amountPattern.test(amountValue)) {
    errors.amountDecimal =
      "Usa un decimal positivo con máximo 6 posiciones decimales.";
  } else if (Number(amountValue) <= 0) {
    errors.amountDecimal = "El monto debe ser mayor a cero.";
  }

  return errors;
};

const resolveRowForTarget = (
  rows: SystemKreditDirectoryRow[],
  targetType: "team" | "sponsor",
  targetId: string,
) => {
  if (targetType === "team") {
    return rows.find((row) => row.teamId === targetId) ?? null;
  }

  return rows.find((row) => row.sponsorId === targetId) ?? null;
};

export function SystemKreditsClient({
  initialRows,
}: SystemKreditsClientProps) {
  const toastTimeoutRef = useRef<number | null>(null);
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<InjectionFormState>(
    buildInitialFormState(),
  );
  const [formErrors, setFormErrors] = useState<InjectionFormErrors>({});
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const teamOptions = useMemo(() => {
    const seen = new Set<string>();

    return rows.reduce<Array<{ id: string; label: string }>>((acc, row) => {
      if (seen.has(row.teamId)) {
        return acc;
      }

      seen.add(row.teamId);
      acc.push({
        id: row.teamId,
        label: `${row.teamName} · ${row.workspaceName}`,
      });
      return acc;
    }, []);
  }, [rows]);

  const sponsorOptions = useMemo(
    () =>
      rows.map((row) => ({
        id: row.sponsorId,
        label: `${row.userName} · ${row.teamName}`,
      })),
    [rows],
  );

  const targetOptions =
    formState.targetType === "team" ? teamOptions : sponsorOptions;
  const availableTargetIds = useMemo(
    () => new Set(targetOptions.map((option) => option.id)),
    [targetOptions],
  );

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.userName,
        row.email,
        row.teamName,
        row.workspaceName,
        row.sponsorName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, rows]);

  const totalBalance = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const nextValue = Number(row.kreditBalance);
        return Number.isFinite(nextValue) ? sum + nextValue : sum;
      }, 0),
    [rows],
  );

  const showToast = (title: string, description?: string | null) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({
      title,
      description: description ?? null,
    });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 6000);
  };

  const resetMessages = () => {
    setFeedback(null);
    setFormErrors({});
  };

  const openModal = (row?: SystemKreditDirectoryRow, targetType?: "team" | "sponsor") => {
    resetMessages();
    const baseState = buildInitialFormState(row);

    setFormState({
      ...baseState,
      targetType: targetType ?? baseState.targetType,
      targetId:
        targetType === "team"
          ? (row?.teamId ?? "")
          : targetType === "sponsor"
            ? (row?.sponsorId ?? "")
            : baseState.targetId,
    });
    setIsModalOpen(true);
  };

  const closeModal = (options?: { force?: boolean }) => {
    if (isPending && !options?.force) {
      return;
    }

    setIsModalOpen(false);
    setFormState(buildInitialFormState());
    setFormErrors({});
  };

  const refreshDirectory = async () => {
    setIsRefreshing(true);

    try {
      const latestRows = await authenticatedOperationRequest<
        SystemKreditDirectoryRow[]
      >("/system/kredits/directory", {
        method: "GET",
      });
      setRows(latestRows);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTargetTypeChange = (targetType: "team" | "sponsor") => {
    setFormState((current) => ({
      ...current,
      targetType,
      targetId:
        targetType === "team"
          ? teamOptions[0]?.id ?? ""
          : sponsorOptions[0]?.id ?? "",
    }));
    setFormErrors((current) => ({
      ...current,
      targetId: undefined,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors = validateForm(formState, availableTargetIds);

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setFeedback({
        tone: "error",
        message:
          "Revisa el destino y el monto antes de confirmar la carga manual.",
      });
      return;
    }

    if (!formState.confirmationChecked) {
      setFeedback({
        tone: "error",
        message:
          "Confirma explícitamente que entiendes el impacto contable antes de cargar Kredits.",
      });
      return;
    }

    const payload: SystemKreditInjectionRequest = {
      targetType: formState.targetType,
      targetId: formState.targetId,
      amountDecimal: normalizeText(formState.amountDecimal),
      ...(normalizeText(formState.reason)
        ? { reason: normalizeText(formState.reason) }
        : {}),
      ...(normalizeText(formState.note)
        ? { note: normalizeText(formState.note) }
        : {}),
    };

    startTransition(() => {
      void (async () => {
        try {
          const result = await authenticatedOperationRequest<SystemKreditInjectionResponse>(
            "/system/kredits/injections",
            {
              method: "POST",
              body: JSON.stringify(payload),
            },
          );

          if (payload.targetType === "sponsor") {
            setRows((current) =>
              current.map((row) =>
                row.sponsorId === payload.targetId
                  ? { ...row, kreditBalance: result.balance.balance }
                  : row,
              ),
            );
          }

          const targetRow = resolveRowForTarget(
            rows,
            payload.targetType,
            payload.targetId,
          );
          const targetLabel =
            payload.targetType === "team"
              ? targetRow?.teamName ?? "Agencia"
              : targetRow?.userName ?? "Sponsor";
          const amountLabel = formatKredits(result.requestedAmount);
          const successMessage =
            payload.targetType === "team"
              ? `Carga confirmada para ${targetLabel}. ReferenceId: ${result.referenceId}. La tabla sigue mostrando saldos sponsor, así que la carga quedó auditada aunque ese valor no cambie en esta fila.`
              : `Carga confirmada para ${targetLabel}. ReferenceId: ${result.referenceId}.`;

          setFeedback({
            tone: "success",
            message: successMessage,
          });
          showToast(
            "Kredits acreditados",
            `${amountLabel} KREDITs enviados. Ref ${result.referenceId}.`,
          );
          closeModal({ force: true });

          try {
            await refreshDirectory();
          } catch {
            showToast(
              "Carga aplicada",
              "La inyección quedó registrada, pero no pudimos refrescar el directorio en este momento.",
            );
          }
        } catch (error) {
          setFeedback({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "No pudimos completar la carga manual.",
          });
        }
      })();
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Kredits"
        title="Directorio maestro de saldos"
        description="Consolida identidad, sponsor operativo y agencia en una sola mesa de control. Desde aquí puedes auditar saldos visibles, disparar cargas manuales y conservar trazabilidad con referenceId sin salir del panel premium."
        actions={
          <div className="flex w-full flex-wrap gap-3 md:w-auto">
            <button
              type="button"
              onClick={() => void refreshDirectory()}
              disabled={isRefreshing || isPending}
              className={secondaryButtonClassName}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                {isRefreshing ? "Refrescando..." : "Refrescar"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => openModal()}
              className={primaryButtonClassName}
            >
              Nueva carga manual
            </button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Usuarios visibles"
          value={formatCompactNumber(rows.length)}
          hint="Identidades enlazadas a sponsor activo dentro del directorio auditable."
        />
        <KpiCard
          label="Agencias mapeadas"
          value={formatCompactNumber(teamOptions.length)}
          hint="Teams con al menos un sponsor operativo presente en la vista."
        />
        <KpiCard
          label="Kredits visibles"
          value={formatKredits(totalBalance.toFixed(6))}
          hint="Suma referencial de los saldos sponsor que hoy reporta el wallet engine."
        />
        <KpiCard
          label="Workspaces"
          value={formatCompactNumber(new Set(rows.map((row) => row.workspaceId)).size)}
          hint="Capas de tenancy activas detrás del directorio maestro."
        />
      </section>

      <section className="rounded-[2rem] border border-app-border bg-app-surface p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-accent">
              Vista premium
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
              Usuarios, sponsors y agencias con saldo vivo
            </h2>
            <p className="mt-2 text-sm leading-7 text-app-text-muted">
              Usa la búsqueda para ubicar rápido una persona, una agencia o un
              workspace y abrir la carga manual con el destino ya preseleccionado.
            </p>
          </div>
          <label className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-soft" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por usuario, email o agencia"
              className="w-full rounded-full border border-app-border bg-app-card px-11 py-3 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
            />
          </label>
        </div>
      </section>

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      {toast ? (
        <div className="rounded-[1.75rem] border border-app-border bg-app-card px-5 py-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold text-app-text">{toast.title}</p>
          {toast.description ? (
            <p className="mt-1 text-sm leading-6 text-app-text-muted">
              {toast.description}
            </p>
          ) : null}
        </div>
      ) : null}

      <DataTable
        columns={[
          {
            key: "identity",
            header: "Usuario",
            render: (row) => (
              <div className="flex flex-col gap-2">
                <div>
                  <p className="font-semibold text-app-text">{row.userName}</p>
                  <p className="text-xs text-app-text-soft">{row.email}</p>
                </div>
                <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">
                  Sponsor · {row.sponsorName}
                </p>
              </div>
            ),
          },
          {
            key: "team",
            header: "Agencia",
            render: (row) => (
              <div className="flex flex-col gap-1">
                <p className="font-medium text-app-text">{row.teamName}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">
                  {row.workspaceName}
                </p>
              </div>
            ),
          },
          {
            key: "balance",
            header: "Saldo actual",
            render: (row) => (
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-app-border bg-app-surface-muted text-app-accent">
                  <Wallet className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-app-text">
                    {formatKredits(row.kreditBalance)} KREDITs
                  </p>
                  <p className="text-xs text-app-text-soft">
                    Cuenta sponsor visible en el directorio
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: "ids",
            header: "IDs operativos",
            render: (row) => (
              <div className="space-y-1 text-xs text-app-text-soft">
                <p>Sponsor: {row.sponsorId}</p>
                <p>Team: {row.teamId}</p>
              </div>
            ),
          },
          {
            key: "actions",
            header: "Acciones",
            className: "whitespace-nowrap",
            render: (row) => (
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() => openModal(row, "sponsor")}
                  className={primaryButtonClassName}
                >
                  Cargar sponsor
                </button>
                <button
                  type="button"
                  onClick={() => openModal(row, "team")}
                  className={secondaryButtonClassName}
                >
                  Cargar agencia
                </button>
              </div>
            ),
          },
        ]}
        rows={visibleRows}
        emptyEyebrow="Kredits"
        emptyTitle="No encontramos usuarios en el directorio"
        emptyDescription="Cuando existan usuarios enlazados a sponsor y wallet aparecerán aquí con su agencia y saldo visible."
      />

      {isModalOpen ? (
        <ModalShell
          eyebrow="Super Admin / Kredit Injection"
          title="Inyectar Kredits"
          description="Opera una carga manual sobre una billetera de sponsor o de agencia. El sistema generará un referenceId auditable y enviará el monto como decimal string al backend."
          onClose={closeModal}
        >
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-app-text">
                  Destino de la carga
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["sponsor", "team"] as const).map((targetType) => (
                    <button
                      key={targetType}
                      type="button"
                      onClick={() => handleTargetTypeChange(targetType)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        formState.targetType === targetType
                          ? "border-app-accent bg-app-accent-soft text-app-accent"
                          : "border-app-border bg-app-surface-muted text-app-text-muted hover:border-app-border-strong hover:text-app-text"
                      }`}
                    >
                      {targetType === "sponsor" ? "Sponsor" : "Agencia"}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-app-text">
                  Target ID
                </span>
                <select
                  value={formState.targetId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      targetId: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-[1.4rem] border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                >
                  <option value="">Selecciona un destino</option>
                  {targetOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formErrors.targetId ? (
                  <p className="mt-2 text-sm text-app-danger-text">
                    {formErrors.targetId}
                  </p>
                ) : null}
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-app-text">
                  Monto decimal
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formState.amountDecimal}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      amountDecimal: event.target.value,
                    }))
                  }
                  placeholder="3.500000"
                  className="mt-2 w-full rounded-[1.4rem] border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                />
                <p className="mt-2 text-xs leading-5 text-app-text-soft">
                  Se enviará como string decimal al API. Ejemplo válido:
                  {" "}
                  <span className="font-semibold text-app-text">3.5</span> o
                  {" "}
                  <span className="font-semibold text-app-text">3.500000</span>.
                </p>
                {formErrors.amountDecimal ? (
                  <p className="mt-2 text-sm text-app-danger-text">
                    {formErrors.amountDecimal}
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-app-text">
                  Razón operativa
                </span>
                <input
                  type="text"
                  value={formState.reason}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Compensación manual, soporte, ajuste..."
                  className="mt-2 w-full rounded-[1.4rem] border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-app-text">
                Nota interna
              </span>
              <textarea
                value={formState.note}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                rows={4}
                placeholder="Contexto adicional para soporte o auditoría."
                className="mt-2 w-full rounded-[1.4rem] border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
              />
            </label>

            <div className="rounded-[1.6rem] border border-app-border bg-app-surface-muted px-5 py-4">
              <label className="flex items-start gap-3 text-sm leading-6 text-app-text-muted">
                <input
                  type="checkbox"
                  checked={formState.confirmationChecked}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      confirmationChecked: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-app-border text-app-accent focus:ring-app-accent-soft"
                />
                <span>
                  Confirmo que esta carga es manual, impacta una billetera real
                  y debe quedar auditada con referenceId.
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-app-border pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => closeModal()}
                disabled={isPending}
                className={secondaryButtonClassName}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={primaryButtonClassName}
              >
                {isPending ? "Confirmando carga..." : "Confirmar carga"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
