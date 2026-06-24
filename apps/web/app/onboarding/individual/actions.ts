"use server";

import { redirect } from "next/navigation";
import {
  type IndividualOnboardingFormState,
  submitIndividualOnboarding,
} from "@/lib/individual-onboarding";
import { apiFetchWithSession } from "@/lib/auth";

export const submitIndividualOnboardingAction = async (
  _previousState: IndividualOnboardingFormState,
  formData: FormData,
): Promise<IndividualOnboardingFormState> => {
  const result = await submitIndividualOnboarding(formData, apiFetchWithSession);

  if (!result.ok) {
    if (result.status === 401) {
      redirect("/login");
    }

    return {
      errorMessage: result.errorMessage,
    };
  }

  redirect(result.redirectTo);
};
