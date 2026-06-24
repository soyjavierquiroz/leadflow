import { describe, expect, it } from "vitest";
import {
  canInviteMembers,
  canShowAdvancedRouting,
  canShowTeamFeatures,
  getVisibleRoleLabel,
  isCommercialTeam,
  isIndividualAccount,
  isPersonalTeam,
  isTeamAccount,
} from "@/lib/account-semantics";

describe("account semantics", () => {
  it("treats a legacy workspace without accountType as team", () => {
    expect(isTeamAccount({})).toBe(true);
  });

  it("identifies team accounts", () => {
    expect(isTeamAccount({ accountType: "team" })).toBe(true);
  });

  it("identifies individual accounts", () => {
    expect(isIndividualAccount({ accountType: "individual" })).toBe(true);
  });

  it("treats a legacy team without teamType as commercial_team", () => {
    expect(isCommercialTeam({})).toBe(true);
  });

  it("identifies commercial teams", () => {
    expect(isCommercialTeam({ teamType: "commercial_team" })).toBe(true);
  });

  it("identifies personal teams", () => {
    expect(isPersonalTeam({ teamType: "personal" })).toBe(true);
  });

  it("returns visible role labels without changing internal roles", () => {
    const teamAdminRole = "TEAM_ADMIN";
    const memberRole = "MEMBER";

    expect(
      getVisibleRoleLabel(
        teamAdminRole,
        { accountType: "individual" },
        { teamType: "personal" },
      ),
    ).toBe("Propietario de Cuenta");
    expect(teamAdminRole).toBe("TEAM_ADMIN");

    expect(
      getVisibleRoleLabel(
        memberRole,
        { accountType: "microteam" },
        { teamType: "personal" },
      ),
    ).toBe("Asistente");
    expect(memberRole).toBe("MEMBER");

    expect(
      getVisibleRoleLabel(
        memberRole,
        { accountType: "team" },
        { teamType: "commercial_team" },
      ),
    ).toBe("Asesor");
    expect(getVisibleRoleLabel("SUPER_ADMIN")).toBe("Super Admin");
  });

  it("keeps current team commercial capabilities enabled by default", () => {
    const workspace = { accountType: "team" };
    const team = { teamType: "commercial_team" };

    expect(canShowTeamFeatures(workspace, team)).toBe(true);
    expect(canInviteMembers(workspace, team)).toBe(true);
    expect(canShowAdvancedRouting(workspace, team)).toBe(true);
  });
});
