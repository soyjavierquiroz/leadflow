import { redirect } from "next/navigation";
import { IndividualOnboardingForm } from "@/components/onboarding/individual-onboarding-form";
import { getSessionUser } from "@/lib/auth";
import { submitIndividualOnboardingAction } from "./actions";

export default async function IndividualOnboardingPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef7fb_46%,#f8fafc_100%)] px-5 py-10 text-slate-950 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-6">
            <div className="inline-flex rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-medium text-cyan-800 shadow-sm">
              Propietario de Cuenta
            </div>
            <div>
              <h2 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Tu operación empieza con un panel simple.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                Configura tu espacio inicial para gestionar contactos,
                conversaciones y seguimiento comercial desde tu panel.
              </p>
            </div>
          </section>

          <IndividualOnboardingForm action={submitIndividualOnboardingAction} />
        </div>
      </div>
    </main>
  );
}
