import type { TeamType } from '../teams/interfaces/team.interface';
import type { AccountType } from '../workspaces/interfaces/workspace.interface';

export type AccountSemanticWorkspace = {
  accountType?: AccountType | string | null;
} | null;

export type AccountSemanticTeam = {
  teamType?: TeamType | string | null;
} | null;

export type InternalUserRole = 'SUPER_ADMIN' | 'TEAM_ADMIN' | 'MEMBER';

export const DEFAULT_ACCOUNT_TYPE: AccountType = 'team';
export const DEFAULT_TEAM_TYPE: TeamType = 'commercial_team';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  individual: 'Individual',
  microteam: 'Microteam',
  team: 'Team',
  enterprise: 'Enterprise',
};

export const TEAM_TYPE_LABELS: Record<TeamType, string> = {
  personal: 'Personal',
  commercial_team: 'Equipo comercial',
  department: 'Departamento',
};

const ACCOUNT_TYPES = new Set<AccountType>([
  'individual',
  'microteam',
  'team',
  'enterprise',
]);

const TEAM_TYPES = new Set<TeamType>([
  'personal',
  'commercial_team',
  'department',
]);

export const resolveAccountType = (
  workspace: AccountSemanticWorkspace | undefined,
): AccountType => {
  const value = workspace?.accountType;
  return typeof value === 'string' && ACCOUNT_TYPES.has(value as AccountType)
    ? (value as AccountType)
    : DEFAULT_ACCOUNT_TYPE;
};

export const resolveTeamType = (
  team: AccountSemanticTeam | undefined,
): TeamType => {
  const value = team?.teamType;
  return typeof value === 'string' && TEAM_TYPES.has(value as TeamType)
    ? (value as TeamType)
    : DEFAULT_TEAM_TYPE;
};

export const isIndividualAccount = (
  workspace: AccountSemanticWorkspace | undefined,
) => resolveAccountType(workspace) === 'individual';

export const isMicroteamAccount = (
  workspace: AccountSemanticWorkspace | undefined,
) => resolveAccountType(workspace) === 'microteam';

export const isTeamAccount = (workspace: AccountSemanticWorkspace | undefined) =>
  resolveAccountType(workspace) === 'team';

export const isEnterpriseAccount = (
  workspace: AccountSemanticWorkspace | undefined,
) => resolveAccountType(workspace) === 'enterprise';

export const isPersonalTeam = (team: AccountSemanticTeam | undefined) =>
  resolveTeamType(team) === 'personal';

export const isCommercialTeam = (team: AccountSemanticTeam | undefined) =>
  resolveTeamType(team) === 'commercial_team';

export const isDepartmentTeam = (team: AccountSemanticTeam | undefined) =>
  resolveTeamType(team) === 'department';

export const canShowTeamFeatures = (
  workspace: AccountSemanticWorkspace | undefined,
  _team?: AccountSemanticTeam | undefined,
) => !isIndividualAccount(workspace);

export const canInviteMembers = (
  workspace: AccountSemanticWorkspace | undefined,
  _team?: AccountSemanticTeam | undefined,
) =>
  isMicroteamAccount(workspace) ||
  isTeamAccount(workspace) ||
  isEnterpriseAccount(workspace);

export const canShowAdvancedRouting = (
  workspace: AccountSemanticWorkspace | undefined,
  team: AccountSemanticTeam | undefined,
) =>
  (isTeamAccount(workspace) || isEnterpriseAccount(workspace)) &&
  (isCommercialTeam(team) || isDepartmentTeam(team));

export const getVisibleRoleLabel = (
  role: InternalUserRole,
  workspace?: AccountSemanticWorkspace | undefined,
  team?: AccountSemanticTeam | undefined,
) => {
  if (role === 'SUPER_ADMIN') {
    return 'Super Admin';
  }

  if (role === 'TEAM_ADMIN') {
    return isIndividualAccount(workspace) || isPersonalTeam(team)
      ? 'Propietario de Cuenta'
      : 'Administrador';
  }

  if (isPersonalTeam(team) || isMicroteamAccount(workspace)) {
    return 'Asistente';
  }

  if (isDepartmentTeam(team)) {
    return 'Miembro';
  }

  return 'Asesor';
};
