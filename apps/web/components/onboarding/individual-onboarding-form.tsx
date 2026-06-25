"use client";

import { ArrowRight, Building2, Globe2, Phone, Sparkles } from "lucide-react";
import { individualNiches } from "@leadflow/account-model";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  getIndividualOnboardingSubmitLabel,
  type IndividualOnboardingFormState,
} from "@/lib/individual-onboarding";

const initialState: IndividualOnboardingFormState = {
  errorMessage: null,
};

type IndividualOnboardingFormProps = {
  action: (
    previousState: IndividualOnboardingFormState,
    formData: FormData,
  ) => Promise<IndividualOnboardingFormState>;
  initialFormState?: IndividualOnboardingFormState;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  const label = getIndividualOnboardingSubmitLabel(pending);

  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-cyan-200/70 bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span>{label}</span>
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5"
      />
    </button>
  );
}

export function IndividualOnboardingForm({
  action,
  initialFormState = initialState,
}: IndividualOnboardingFormProps) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form
      action={formAction}
      className="w-full rounded-lg border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-7"
    >
      <div>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
          <Sparkles aria-hidden="true" className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Crea tu espacio de ventas
        </h1>
        <div className="mt-4 space-y-2 text-base leading-7 text-slate-600">
          <p>Organiza tus prospectos de WhatsApp</p>
          <p>Empieza solo y luego invita a tu equipo</p>
        </div>
      </div>

      <div className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">
            Nombre del negocio
          </span>
          <span className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 transition duration-200 focus-within:border-cyan-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-100">
            <Building2
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-slate-400"
            />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              type="text"
              name="businessName"
              autoComplete="organization"
              placeholder="Ej. Ana Studio"
              required
            />
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-800">
            Tipo de negocio
          </span>
          <select
            name="niche"
            defaultValue=""
            className="mt-2 min-h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
          >
            <option value="">Selecciona el tipo de negocio</option>
            {individualNiches.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-800">País</span>
            <span className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 transition duration-200 focus-within:border-cyan-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-100">
              <Globe2
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-slate-400"
              />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                type="text"
                name="country"
                autoComplete="country-name"
                placeholder="Ej. México"
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-800">Teléfono</span>
            <span className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 transition duration-200 focus-within:border-cyan-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-100">
              <Phone
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-slate-400"
              />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder="+52..."
              />
            </span>
          </label>
        </div>

        {state.errorMessage ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {state.errorMessage}
          </div>
        ) : null}

        <SubmitButton />
      </div>
    </form>
  );
}
