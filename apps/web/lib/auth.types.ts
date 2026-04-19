export type AppUserRole = "SUPER_ADMIN" | "TEAM_ADMIN" | "MEMBER";

export type AuthenticatedAppUser = {
  id: string;
  fullName: string;
  email: string;
  role: AppUserRole;
  workspaceId: string | null;
  teamId: string | null;
  sponsorId: string | null;
  homePath: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    primaryDomain: string | null;
  } | null;
  team: {
    id: string;
    name: string;
    code: string;
  } | null;
  sponsor: {
    id: string;
    displayName: string;
    email: string | null;
    isActive: boolean;
    availabilityStatus: string;
  } | null;
};
