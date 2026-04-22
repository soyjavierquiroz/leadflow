import { MemberDashboardClient } from "@/components/member-operations/member-dashboard-client";
import { requireOperationalViewUser } from "@/lib/auth";
import { getMemberDashboardSnapshot } from "@/lib/member-dashboard";

type EvolutionInstanceNameInput = {
  teamName: string | null | undefined;
  workspaceName: string | null | undefined;
  fullName: string | null | undefined;
};

/**
 * Normaliza un segmento de `instanceName` a minúsculas ASCII alfanuméricas
 * para mantener compatibilidad con Evolution y facilitar el soporte operativo.
 */
const sanitizeInstanceSegment = (value: string | null | undefined) => {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  return normalized.trim();
};

/**
 * Construye el nombre determinístico y legible de la instancia Evolution
 * usando el equipo operativo y el primer nombre del asesor.
 */
const buildEvolutionInstanceName = (
  input: EvolutionInstanceNameInput,
): string => {
  const teamSegment =
    sanitizeInstanceSegment(input.teamName) ||
    sanitizeInstanceSegment(input.workspaceName) ||
    "team";
  const firstName =
    input.fullName
      ?.trim()
      .split(/\s+/)
      .find((segment) => segment.trim().length > 0) ?? null;
  const userSegment = sanitizeInstanceSegment(firstName) || "user";

  return `lf-${teamSegment}-${userSegment}`;
};

export default async function MemberPage() {
  const user = await requireOperationalViewUser();
  const dashboard = await getMemberDashboardSnapshot();
  const instanceName = buildEvolutionInstanceName({
    teamName: user.team?.name,
    workspaceName: user.workspace?.name,
    fullName: user.fullName,
  });

  return (
    <MemberDashboardClient
      initialDashboard={dashboard}
      instanceName={instanceName}
    />
  );
}
