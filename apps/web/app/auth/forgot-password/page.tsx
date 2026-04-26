import { ForgotPasswordForm } from "./forgot-password-form";

export const runtime = "nodejs";

export default function ForgotPasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-5 py-10 text-white md:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(45,212,191,0.20),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.14),transparent_32%),linear-gradient(180deg,#020617_0%,#07111f_52%,#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:radial-gradient(rgba(255,255,255,0.42)_0.7px,transparent_0.7px)] [background-size:5px_5px]" />

      <div className="relative z-10 w-full max-w-[480px]">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
