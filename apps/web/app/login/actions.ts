"use server";

import { redirect } from "next/navigation";
import { loginWithServerSession } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/mail";
import {
  createPasswordResetToken,
  hashPassword,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

export type LoginFormState = {
  errorMessage: string | null;
  rememberMe: boolean;
};

export type PasswordResetRequestResult = {
  ok: boolean;
  errorMessage?: string;
};

export type PasswordResetRequestFormState = {
  errorMessage: string | null;
  successMessage: string | null;
};

export type ResetPasswordFormState = {
  errorMessage: string | null;
  successMessage: string | null;
};

const getPublicAppUrl = () =>
  (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://leadflow.kuruk.in"
  ).replace(/\/+$/, "");

export const submitLoginAction = async (
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> => {
  const email = formData.get("email");
  const password = formData.get("password");
  const rememberMe = formData.get("rememberMe") === "on";

  let result: Awaited<ReturnType<typeof loginWithServerSession>>;

  try {
    result = await loginWithServerSession({
      email: typeof email === "string" ? email : "",
      password: typeof password === "string" ? password : "",
      rememberMe,
    });
  } catch (error) {
    console.error("\n🔥 CRITICAL LOGIN FRONTEND ERROR:\n", error, "\n");

    return {
      errorMessage: "Ocurrio un error interno al procesar el login.",
      rememberMe,
    };
  }

  if (!result.ok) {
    return {
      errorMessage: result.errorMessage,
      rememberMe,
    };
  }

  redirect(result.redirectUrl);
};

export const requestPasswordReset = async (
  email: string,
): Promise<PasswordResetRequestResult> => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      errorMessage: "Ingresa tu email para continuar.",
      ok: false,
    };
  }

  try {
    const user = await prisma.user.findUnique({
      select: {
        id: true,
      },
      where: {
        email: normalizedEmail,
      },
    });

    if (user) {
      const token = createPasswordResetToken();
      const resetToken = hashPasswordResetToken(token);
      const resetTokenExpires = new Date(
        Date.now() + PASSWORD_RESET_TOKEN_TTL_MS,
      );

      await prisma.user.update({
        data: {
          resetToken,
          resetTokenExpires,
        },
        where: {
          id: user.id,
        },
      });

      const resetUrl = `${getPublicAppUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;

      await sendPasswordResetEmail({
        resetUrl,
        toAddress: normalizedEmail,
      });
    }

    return {
      ok: true,
    };
  } catch (error) {
    console.error("[password-reset] request failed", error);

    return {
      errorMessage:
        "No pudimos iniciar la recuperación. Intenta nuevamente en unos minutos.",
      ok: false,
    };
  }
};

export const submitPasswordResetRequestAction = async (
  _previousState: PasswordResetRequestFormState,
  formData: FormData,
): Promise<PasswordResetRequestFormState> => {
  const email = formData.get("email");
  const result = await requestPasswordReset(
    typeof email === "string" ? email : "",
  );

  if (!result.ok) {
    return {
      errorMessage: result.errorMessage ?? "No pudimos procesar la solicitud.",
      successMessage: null,
    };
  }

  return {
    errorMessage: null,
    successMessage:
      "Si el email existe en Leadflow, enviaremos instrucciones para recuperar el acceso.",
  };
};

export const isPasswordResetTokenValid = async (token: string) => {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return false;
  }

  const user = await prisma.user.findFirst({
    select: {
      id: true,
    },
    where: {
      resetToken: hashPasswordResetToken(normalizedToken),
      resetTokenExpires: {
        gt: new Date(),
      },
    },
  });

  return Boolean(user);
};

export const resetPasswordAction = async (
  _previousState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> => {
  const token = formData.get("token");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  const normalizedToken = typeof token === "string" ? token.trim() : "";
  const newPassword = typeof password === "string" ? password : "";
  const repeatedPassword =
    typeof confirmPassword === "string" ? confirmPassword : "";

  if (!normalizedToken) {
    return {
      errorMessage: "El enlace de recuperación no es válido.",
      successMessage: null,
    };
  }

  if (newPassword.length < 8) {
    return {
      errorMessage: "La nueva contraseña debe tener al menos 8 caracteres.",
      successMessage: null,
    };
  }

  if (newPassword !== repeatedPassword) {
    return {
      errorMessage: "La confirmación no coincide con la nueva contraseña.",
      successMessage: null,
    };
  }

  const resetToken = hashPasswordResetToken(normalizedToken);
  const user = await prisma.user.findFirst({
    select: {
      id: true,
    },
    where: {
      resetToken,
      resetTokenExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    return {
      errorMessage: "El enlace de recuperación expiró o ya fue utilizado.",
      successMessage: null,
    };
  }

  await prisma.user.update({
    data: {
      passwordHash: hashPassword(newPassword),
      resetToken: null,
      resetTokenExpires: null,
    },
    where: {
      id: user.id,
    },
  });

  return {
    errorMessage: null,
    successMessage: "Tu contraseña fue actualizada. Ya puedes iniciar sesión.",
  };
};
