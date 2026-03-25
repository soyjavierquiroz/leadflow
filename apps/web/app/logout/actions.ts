"use server";

import { redirect } from "next/navigation";
import { logoutWithServerSession } from "@/lib/auth";

export type LogoutFormState = {
  errorMessage: string | null;
};

export const submitLogoutAction = async (
  previousState: LogoutFormState,
  formData: FormData,
): Promise<LogoutFormState> => {
  void previousState;
  void formData;

  const result = await logoutWithServerSession();

  if (!result.ok) {
    return {
      errorMessage: result.errorMessage,
    };
  }

  redirect("/login");
};
