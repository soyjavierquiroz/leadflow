"use server";

import {
  impersonateWithServerSession,
  type ImpersonationApiResponse,
} from "@/lib/auth";

export type TeamMemberImpersonationActionResult = {
  success: false;
  message: string;
} | ImpersonationApiResponse;

export const submitTeamMemberImpersonationAction = async (
  targetUserId: string,
): Promise<TeamMemberImpersonationActionResult> => {
  const result = await impersonateWithServerSession({
    targetUserId,
  });

  if (!result.ok) {
    return {
      success: false,
      message: result.errorMessage,
    };
  }

  return result.payload;
};
