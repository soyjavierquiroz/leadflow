import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { isPasswordResetTokenValid } from "@/app/login/actions";
import { ResetPasswordForm } from "./reset-password-form";

export const runtime = "nodejs";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

function InvalidTokenCard() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.075] p-6 text-center shadow-[0_32px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-8">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-rose-200/20 bg-rose-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_60px_rgba(244,63,94,0.12)]">
        <span className="text-2xl font-black tracking-tight text-white">LF</span>
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-rose-100/70">
        Enlace inválido
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Solicita uno nuevo
      </h1>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-300">
        Este enlace expiró, ya fue utilizado o no pertenece a una solicitud
        activa.
      </p>
      <Link
        href="/auth/forgot-password"
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-[linear-gradient(135deg,#f8fafc_0%,#d7fff7_44%,#8ddff0_100%)] px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_50px_rgba(45,212,191,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_70px_rgba(45,212,191,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
      >
        Enviar instrucciones
      </Link>
    </div>
  );
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  noStore();

  const query = await searchParams;
  const token = query.token ?? "";
  const isValidToken = await isPasswordResetTokenValid(token);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-5 py-10 text-white md:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(45,212,191,0.20),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.14),transparent_32%),linear-gradient(180deg,#020617_0%,#07111f_52%,#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:radial-gradient(rgba(255,255,255,0.42)_0.7px,transparent_0.7px)] [background-size:5px_5px]" />

      <div className="relative z-10 w-full max-w-[480px]">
        {isValidToken ? <ResetPasswordForm token={token} /> : <InvalidTokenCard />}
      </div>
    </main>
  );
}
