import { webPublicConfig } from '@/lib/public-env';

export default function MembersPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-6 py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Sponsors Members Shell
        </h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Base inicial del panel para sponsors. Aqui viviran dashboards de
          seguimiento, estado de cuentas y flujos de asignacion de leads.
        </p>
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-slate-800">URL objetivo</dt>
            <dd className="font-mono text-slate-600">{webPublicConfig.urls.members}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-800">API de referencia</dt>
            <dd className="font-mono text-slate-600">{webPublicConfig.urls.api}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
