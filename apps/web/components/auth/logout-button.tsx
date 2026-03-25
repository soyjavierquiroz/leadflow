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
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
    <form action={formAction} className="flex flex-col items-end gap-2">
      <LogoutSubmitButton />
      {state.errorMessage ? (
        <div
          aria-live="polite"
          className="max-w-72 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-right text-xs font-medium text-rose-700"
        >
          {state.errorMessage}
        </div>
      ) : null}
    </form>
  );
}
