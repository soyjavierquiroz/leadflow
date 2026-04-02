"use client";

import { useState } from "react";
import { webPublicConfig } from "@/lib/public-env";

type RuntimeLeadSubmitFormProps = {
  hostname: string;
  path: string;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as {
      message?: string | { message?: string } | string[];
      error?: string;
    };

    if (typeof payload.message === "string") {
      return payload.message;
    }

    if (Array.isArray(payload.message)) {
      return payload.message.join(", ");
    }

    if (
      payload.message &&
      typeof payload.message === "object" &&
      "message" in payload.message &&
      typeof payload.message.message === "string"
    ) {
      return payload.message.message;
    }

    if (typeof payload.error === "string") {
      return payload.error;
    }
  } catch {}

  return `La solicitud fallo con estado ${response.status}.`;
};

export function RuntimeLeadSubmitForm({
  hostname,
  path,
}: RuntimeLeadSubmitFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${webPublicConfig.urls.api}/v1/public/runtime/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hostname,
            path,
            firstName: fullName,
            email,
            phone,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      await response.json().catch(() => null);

      setSuccessMessage(
        "Registro exitoso. Un asesor te contactará pronto.",
      );
      setFullName("");
      setEmail("");
      setPhone("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No pudimos enviar tu registro en este momento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">
          Captura de prueba
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Envia un lead al runtime publico
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Este formulario manda la captura al nuevo endpoint facade usando el
          `hostname` y el `path` actuales.
        </p>
      </div>

      <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Nombre
          <input
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-emerald-400 focus:bg-white"
            name="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Tu nombre"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-emerald-400 focus:bg-white"
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Telefono (WhatsApp)
          <input
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-emerald-400 focus:bg-white"
            type="tel"
            name="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+57 300 123 4567"
            required
          />
        </label>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enviando..." : "Enviar registro"}
          </button>
          <span className="text-sm text-slate-500">
            Host actual: {hostname}
          </span>
          <span className="text-sm text-slate-500">Path actual: {path}</span>
        </div>

        {errorMessage ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </p>
        ) : null}
      </form>
    </section>
  );
}
