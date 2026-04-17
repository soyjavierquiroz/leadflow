"use server";

import { redirect } from "next/navigation";
import { loginWithServerSession } from "@/lib/auth";

export type LoginFormState = {
  errorMessage: string | null;
};

export const submitLoginAction = async (
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> => {
  const email = formData.get("email");
  const password = formData.get("password");

  let result: Awaited<ReturnType<typeof loginWithServerSession>>;

  try {
    result = await loginWithServerSession({
      email: typeof email === "string" ? email : "",
      password: typeof password === "string" ? password : "",
    });
  } catch (error) {
    console.error("\n🔥 CRITICAL LOGIN FRONTEND ERROR:\n", error, "\n");

    return {
      errorMessage: "Ocurrio un error interno al procesar el login.",
    };
  }

  if (!result.ok) {
    return {
      errorMessage: result.errorMessage,
    };
  }

  redirect(result.redirectUrl);
};
