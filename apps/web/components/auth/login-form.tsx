"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitLoginAction } from "@/app/login/actions";

type LoginFormProps = {
  demoAccounts: Array<{
    label: string;
    role: string;
    email: string;
    password: string;
  }>;
};

const initialLoginFormState = {
  errorMessage: null,
};

function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-full bg-[var(--app-text)] px-5 py-3 text-sm font-semibold text-[var(--app-bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Ingresando..." : "Entrar a Leadflow"}
    </button>
  );
}

export function LoginForm({ demoAccounts }: LoginFormProps) {
  const [state, formAction] = useActionState(
    submitLoginAction,
    initialLoginFormState,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <form
        action={formAction}
        className="rounded-[2rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-[0_28px_90px_rgba(15,23,42,0.08)]"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-text-soft)]">
            Roles & Auth v1
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--app-text)]">
            Iniciar sesión
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
            Login real con sesión segura, redirects por rol y protección de las
            superficies privadas de Leadflow.
          </p>
        </div>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-[var(--app-text)]">Email</span>
            <input
              className="mt-2 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[var(--app-accent-soft)]"
              type="email"
              name="email"
              defaultValue={demoAccounts[0]?.email ?? ""}
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--app-text)]">Password</span>
            <input
              className="mt-2 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[var(--app-accent-soft)]"
              type="password"
              name="password"
              defaultValue={demoAccounts[0]?.password ?? ""}
              autoComplete="current-password"
              required
            />
          </label>

          {state.errorMessage ? (
            <div className="rounded-2xl border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] px-4 py-3 text-sm text-[var(--app-danger)]">
              {state.errorMessage}
            </div>
          ) : null}

          <LoginSubmitButton />
        </div>
      </form>

      <section className="rounded-[2rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface)_88%,transparent)] p-8 shadow-[0_28px_90px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-text-soft)]">
          Usuarios demo
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--app-text)]">
          Accesos listos para validación
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
          Estos accesos vienen desde el seed y permiten validar rápidamente cada
          superficie.
        </p>

        <div className="mt-6 space-y-4">
          {demoAccounts.map((account) => (
            <div
              key={account.email}
              className="block w-full rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] px-5 py-4 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-[var(--app-text)]">
                    {account.label}
                  </p>
                  <p className="text-sm text-[var(--app-muted)]">{account.role}</p>
                </div>
                <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1 text-xs font-semibold text-[var(--app-muted)]">
                  Demo
                </span>
              </div>
              <p className="mt-3 text-sm text-[var(--app-text)]">{account.email}</p>
              <p className="text-sm text-[var(--app-text-soft)]">{account.password}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
