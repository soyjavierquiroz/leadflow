import type { AuthenticatedAppUser } from "@/lib/auth.types";

export const INDIVIDUAL_ONBOARDING_PATH = "/onboarding/individual";

export const needsIndividualOnboarding = (
  user: AuthenticatedAppUser | null | undefined,
) => {
  if (!user || user.role === "SUPER_ADMIN") {
    return false;
  }

  const belongsToExistingTeam = Boolean(user.teamId || user.team);
  const hasOperationalWorkspaceAndTeam = Boolean(
    user.workspaceId &&
      user.workspace &&
      user.teamId &&
      user.team,
  );
  const hasOperationalSponsor = Boolean(
    user.sponsorId &&
      user.sponsor &&
      user.sponsor.isActive === true,
  );

  return (
    !belongsToExistingTeam &&
    !hasOperationalWorkspaceAndTeam &&
    !hasOperationalSponsor
  );
};

export const getPostAuthRedirectPath = (
  user: AuthenticatedAppUser | null | undefined,
  currentRedirectPath: string,
) =>
  needsIndividualOnboarding(user)
    ? INDIVIDUAL_ONBOARDING_PATH
    : currentRedirectPath;
