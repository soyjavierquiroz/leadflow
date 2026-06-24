import { describe, expect, it } from "vitest";
import type { AuthenticatedAppUser } from "@/lib/auth.types";
import {
  getPostAuthRedirectPath,
  INDIVIDUAL_ONBOARDING_PATH,
  needsIndividualOnboarding,
} from "@/lib/individual-onboarding-routing";

const buildUser = (
  overrides: Partial<AuthenticatedAppUser> = {},
): AuthenticatedAppUser => ({
  id: "user-1",
  fullName: "Ana Owner",
  email: "ana@example.com",
  role: "MEMBER",
  workspaceId: null,
  teamId: null,
  sponsorId: null,
  homePath: "/member",
  workspace: null,
  team: null,
  sponsor: null,
  ...overrides,
});

describe("individual onboarding routing", () => {
  it("sends a new authenticated user without workspace, team or sponsor to onboarding", () => {
    const user = buildUser();

    expect(needsIndividualOnboarding(user)).toBe(true);
    expect(getPostAuthRedirectPath(user, user.homePath)).toBe(
      INDIVIDUAL_ONBOARDING_PATH,
    );
  });

  it("keeps an existing tenant user on the current post-login redirect", () => {
    const user = buildUser({
      role: "TEAM_ADMIN",
      workspaceId: "workspace-1",
      teamId: "team-1",
      sponsorId: "sponsor-1",
      homePath: "/team",
      workspace: {
        id: "workspace-1",
        name: "Workspace Uno",
        slug: "workspace-uno",
        primaryDomain: "workspace.example.com",
      },
      team: {
        id: "team-1",
        name: "Team Uno",
        code: "team-uno",
      },
      sponsor: {
        id: "sponsor-1",
        displayName: "Sponsor Uno",
        email: "ana@example.com",
        isActive: true,
        availabilityStatus: "available",
      },
    });

    expect(needsIndividualOnboarding(user)).toBe(false);
    expect(getPostAuthRedirectPath(user, user.homePath)).toBe("/team");
  });

  it("does not send SUPER_ADMIN users to individual onboarding", () => {
    const user = buildUser({
      role: "SUPER_ADMIN",
      homePath: "/admin",
    });

    expect(needsIndividualOnboarding(user)).toBe(false);
    expect(getPostAuthRedirectPath(user, user.homePath)).toBe("/admin");
  });

  it("does not onboard users that already belong to a team id even if the session is incomplete", () => {
    const user = buildUser({
      teamId: "team-1",
    });

    expect(needsIndividualOnboarding(user)).toBe(false);
    expect(getPostAuthRedirectPath(user, "/member")).toBe("/member");
  });
});
