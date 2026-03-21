import Link from 'next/link';

const bullets = [
  'Captacion centralizada de oportunidades',
  'Asignacion automatica de leads por reglas de negocio',
  'Orquestacion operativa con n8n + Evolution API',
];

export default function SiteHomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12 lg:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-sm backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
          Leadflow v1
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
          Plataforma SaaS para captacion, asignacion y automatizacion de leads
        </h1>
        <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
          Base de producto en construccion con arquitectura modular para equipos
          comerciales, operaciones y automatizacion.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bullets.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/members"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">Members Area</h2>
          <p className="mt-2 text-sm text-slate-600">
            Espacio de trabajo para usuarios autenticados.
          </p>
        </Link>

        <Link
          href="/admin"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">Admin Console</h2>
          <p className="mt-2 text-sm text-slate-600">
            Panel para configuracion operativa y gobernanza.
          </p>
        </Link>

        <a
          href="http://localhost:3001/health"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">API Health</h2>
          <p className="mt-2 text-sm text-slate-600">
            Endpoint basico de salud del backend NestJS.
          </p>
        </a>
      </section>
    </main>
  );
}
