"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  resetPasswordAction,
  type ResetPasswordFormState,
} from "@/app/login/actions";

const initialState: ResetPasswordFormState = {
  errorMessage: null,
  successMessage: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative inline-flex min-h-12 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(135deg,#f8fafc_0%,#d7fff7_44%,#8ddff0_100%)] px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_50px_rgba(45,212,191,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_70px_rgba(45,212,191,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="absolute inset-x-0 top-0 h-px bg-white/80" />
      <span className="relative inline-flex items-center gap-2">
        {pending ? "Actualizando..." : "Actualizar contraseña"}
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 transition duration-300 group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);

  return (
    <form
      action={formAction}
      className="rounded-[28px] border border-white/10 bg-white/[0.075] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-8"
    >
      <input type="hidden" name="token" value={token} />

      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-teal-200/20 bg-[linear-gradient(145deg,rgba(20,184,166,0.18),rgba(59,130,246,0.10))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_60px_rgba(45,212,191,0.16)]">
          <span className="text-2xl font-black tracking-tight text-white">LF</span>
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-teal-100/70">
          Seguridad
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Nueva contraseña
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-300">
          Crea una contraseña nueva para recuperar el acceso a Leadflow.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-200">
            Nueva contraseña
          </span>
          <span className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 focus-within:border-teal-200/45 focus-within:bg-slate-950/60 focus-within:shadow-[0_0_0_1px_rgba(45,212,191,0.18),0_0_36px_rgba(45,212,191,0.12)]">
            <LockKeyhole
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-slate-400"
            />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              required
            />
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-200">Confirmar</span>
          <span className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 focus-within:border-teal-200/45 focus-within:bg-slate-950/60 focus-within:shadow-[0_0_0_1px_rgba(45,212,191,0.18),0_0_36px_rgba(45,212,191,0.12)]">
            <LockKeyhole
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-slate-400"
            />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              required
            />
          </span>
        </label>

        {state.errorMessage ? (
          <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
            {state.errorMessage}
          </div>
        ) : null}

        {state.successMessage ? (
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">
            {state.successMessage}
          </div>
        ) : null}

        <div className="pt-2">
          <SubmitButton />
        </div>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-cyan-500/80 transition duration-200 hover:text-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </form>
  );
}
