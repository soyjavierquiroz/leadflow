import Link from 'next/link';

export default function SiteNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.14),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-6 py-10">
      <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200/80 bg-white/90 p-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          Leadflow Public Runtime
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
          No encontramos una publicacion activa para esta ruta.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Revisa el host, el path publicado o usa `?previewHost=localhost` en desarrollo para simular otra resolucion sin romper el modelo final basado en dominio.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Ir al root publicado
          </Link>
          <Link
            href="/oportunidad"
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Probar subruta /oportunidad
          </Link>
        </div>
      </div>
    </main>
  );
}
