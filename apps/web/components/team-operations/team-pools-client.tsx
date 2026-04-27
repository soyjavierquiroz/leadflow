"use client";

import { useMemo, useState, useTransition } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type {
  RotationPoolMemberRecord,
  RotationPoolRecord,
} from "@/lib/app-shell/types";
import { formatCompactNumber } from "@/lib/app-shell/utils";
import { teamOperationRequest } from "@/lib/team-operations";

type TeamPoolsClientProps = {
  initialPools: RotationPoolRecord[];
  initialMembers: RotationPoolMemberRecord[];
};

const buttonClassName =
  "rounded-full border border-app-border bg-app-card px-4 py-2 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const selectClassName =
  "rounded-full border border-app-border bg-app-card px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft";

export function TeamPoolsClient({
  initialPools,
  initialMembers,
}: TeamPoolsClientProps) {
  const [pools] = useState(initialPools);
  const [members, setMembers] = useState(initialMembers);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const membersByPool = useMemo(() => {
    const map = new Map<string, RotationPoolMemberRecord[]>();

    for (const member of members) {
      const current = map.get(member.rotationPoolId) ?? [];
      current.push(member);
      map.set(member.rotationPoolId, current);
    }

    for (const [poolId, poolMembers] of map.entries()) {
      map.set(
        poolId,
        [...poolMembers].sort((left, right) => left.position - right.position),
      );
    }

    return map;
  }, [members]);

  const handleMemberPatch = (
    memberId: string,
    payload: {
      isActive?: boolean;
      position?: number;
    },
  ) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const updated = await teamOperationRequest<RotationPoolMemberRecord>(
          `/rotation-pools/members/${memberId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );

        setMembers((current) => {
          const currentMember = current.find((item) => item.id === memberId);

          if (!currentMember) {
            return current;
          }

          let next = current.map((item) =>
            item.id === updated.id
              ? updated
              : item.rotationPoolId === updated.rotationPoolId && payload.position !== undefined
                ? item.id === currentMember.id
                  ? item
                  : item.position >= payload.position && item.position < currentMember.position
                    ? {
                        ...item,
                        position: item.position + 1,
                      }
                    : item.position <= payload.position && item.position > currentMember.position
                      ? {
                          ...item,
                          position: item.position - 1,
                        }
                      : item
                : item,
          );

          next = next.map((item) => (item.id === updated.id ? updated : item));
          return next;
        });

        setSuccessMessage("Miembro del pool actualizado.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos actualizar el miembro del pool.",
        );
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Pools"
        title="Pools de rotación del team"
        description="Además de revisar cobertura, el team admin ya puede pausar miembros y reordenar posiciones simples dentro de cada pool."
      />

      {errorMessage ? <OperationBanner tone="error" message={errorMessage} /> : null}
      {successMessage ? (
        <OperationBanner tone="success" message={successMessage} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pools"
          value={formatCompactNumber(pools.length)}
          hint="Contenedores de round robin activos o draft."
        />
        <KpiCard
          label="Fallback"
          value={formatCompactNumber(pools.filter((item) => item.isFallbackPool).length)}
          hint="Pools de respaldo para reglas operativas futuras."
        />
        <KpiCard
          label="Miembros activos"
          value={formatCompactNumber(members.filter((item) => item.isActive).length)}
          hint="Sponsors actualmente elegibles en la rotación."
        />
        <KpiCard
          label="Funnels conectados"
          value={formatCompactNumber(
            pools.reduce((total, item) => total + item.funnelIds.length, 0),
          )}
          hint="Embudos que ya dependen de la rotación del team."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Pool",
            render: (row) => (
              <div>
                <p className="font-semibold text-app-text">{row.name}</p>
                <p className="text-xs text-app-text-soft">{row.strategy}</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => <StatusBadge value={row.status} />,
          },
          {
            key: "coverage",
            header: "Cobertura",
            render: (row) => `${row.sponsorIds.length} sponsors`,
          },
          {
            key: "funnels",
            header: "Funnels",
            render: (row) => `${row.funnelIds.length} conectados`,
          },
          {
            key: "fallback",
            header: "Fallback",
            render: (row) => (row.isFallbackPool ? "Sí" : "No"),
          },
        ]}
        rows={pools}
        emptyTitle="Sin pools para este team"
        emptyDescription="Cuando el team configure pools activos aparecerán aquí con sus sponsors y funnels conectados."
      />

      <div className="space-y-4">
        {pools.map((pool) => {
          const poolMembers = membersByPool.get(pool.id) ?? [];

          return (
            <section
              key={pool.id}
              className="rounded-3xl border border-app-border bg-app-card p-5 text-app-text shadow-[var(--ai-panel-shadow)]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                    Rotation Pool
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-app-text">
                    {pool.name}
                  </h3>
                  <p className="text-sm text-app-text-muted">
                    {poolMembers.length} miembros configurados
                  </p>
                </div>
                <StatusBadge value={pool.status} />
              </div>

              <div className="mt-5 space-y-3">
                {poolMembers.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-app-border bg-app-surface-muted p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-app-text">
                          {member.sponsorName}
                        </p>
                        <p className="text-sm text-app-text-muted">
                          Posición {member.position} · {member.isActive ? "Activo" : "Pausado"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge value={member.sponsorAvailabilityStatus} />
                        <button
                          type="button"
                          onClick={() =>
                            handleMemberPatch(member.id, {
                              isActive: !member.isActive,
                            })
                          }
                          disabled={isPending}
                          className={buttonClassName}
                        >
                          {member.isActive ? "Pausar" : "Activar"}
                        </button>
                        <label className="flex items-center gap-2 text-sm text-app-text-muted">
                          Orden
                          <select
                            value={member.position}
                            onChange={(event) =>
                              handleMemberPatch(member.id, {
                                position: Number(event.target.value),
                              })
                            }
                            disabled={isPending}
                            className={selectClassName}
                          >
                            {poolMembers.map((item) => (
                              <option key={item.id} value={item.position}>
                                {item.position}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
                {poolMembers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-5 text-sm text-app-text-muted">
                    Este pool todavía no tiene miembros operativos.
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
