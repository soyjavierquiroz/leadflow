"use client";

import { useEffect, useRef, useState } from "react";
import { loginWithCredentials, resolveAppUrlForPath } from "@/lib/auth-client";

type LoginFormProps = {
  demoAccounts: Array<{
    label: string;
    role: string;
    email: string;
    password: string;
  }>;
};

export function LoginForm({ demoAccounts }: LoginFormProps) {
  const [email, setEmail] = useState(demoAccounts[0]?.email ?? "");
  const [password, setPassword] = useState(demoAccounts[0]?.password ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current !== null) {
        window.clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (navigationTimeoutRef.current !== null) {
      window.clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload = await loginWithCredentials({
        email,
        password,
      });
      const destinationUrl = resolveAppUrlForPath(payload.redirectPath);

      navigationTimeoutRef.current = window.setTimeout(() => {
        navigationTimeoutRef.current = null;
        setIsSubmitting(false);
        setErrorMessage(
          "El login fue exitoso, pero no pudimos completar la redirección.",
        );
      }, 2500);

      window.location.replace(destinationUrl);
    } catch (error) {
      setIsSubmitting(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No pudimos conectar con el API de autenticación.",
      );
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_28px_90px_rgba(15,23,42,0.08)]"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Roles & Auth v1
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Iniciar sesión
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Login real con sesión segura, redirects por rol y protección de las
            superficies privadas de Leadflow.
          </p>
        </div>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Ingresando..." : "Entrar a Leadflow"}
          </button>
        </div>
      </form>

      <section className="rounded-[2rem] border border-slate-200 bg-white/80 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Usuarios demo
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Accesos listos para validación
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Estos accesos vienen desde el seed y permiten validar rápidamente cada
          superficie.
        </p>

        <div className="mt-6 space-y-4">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
              }}
              className="block w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">
                    {account.label}
                  </p>
                  <p className="text-sm text-slate-600">{account.role}</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  Usar
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{account.email}</p>
              <p className="text-sm text-slate-500">{account.password}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
