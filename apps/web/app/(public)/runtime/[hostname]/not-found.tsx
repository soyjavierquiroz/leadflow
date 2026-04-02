export default function PublicRuntimeNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] px-6 py-12">
      <section className="w-full max-w-3xl rounded-[2rem] border border-slate-200/80 bg-white/90 p-10 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">
          Public Runtime
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
          Pagina no encontrada o inactiva
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          No encontramos una publicacion activa para este host y esta ruta.
        </p>
      </section>
    </main>
  );
}
