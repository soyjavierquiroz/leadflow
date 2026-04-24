"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitLogoutAction } from "@/app/logout/actions";

const initialLogoutFormState = {
  errorMessage: null,
};

function LogoutSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="whitespace-nowrap rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-text-muted transition hover:border-app-border-strong hover:bg-app-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}

export function LogoutButton() {
  const [state, formAction] = useActionState(
    submitLogoutAction,
    initialLogoutFormState,
  );

  return (
    <form action={formAction} className="flex shrink-0 flex-col items-end gap-2">
      <LogoutSubmitButton />
      {state.errorMessage ? (
        <div
          aria-live="polite"
          className="max-w-72 rounded-2xl border border-app-danger-border bg-app-danger-bg px-3 py-2 text-right text-xs font-medium text-app-danger-text"
        >
          {state.errorMessage}
        </div>
      ) : null}
    </form>
  );
}
