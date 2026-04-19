"use server";

import { impersonateWithServerSession } from "@/lib/auth";

export type TeamMemberImpersonationActionResult = {
  errorMessage: string | null;
  ok: boolean;
};

export const submitTeamMemberImpersonationAction = async (
  targetUserId: string,
): Promise<TeamMemberImpersonationActionResult> => {
  const result = await impersonateWithServerSession({
    targetUserId,
  });

  if (!result.ok) {
    return {
      errorMessage: result.errorMessage,
      ok: false,
    };
  }

  return {
    errorMessage: null,
    ok: true,
  };
};
