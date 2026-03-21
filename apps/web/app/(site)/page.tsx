import Link from 'next/link';
import { webPublicConfig } from '@/lib/public-env';

const bullets = [
  'Captacion centralizada de oportunidades',
  'Asignacion automatica por reglas configurables',
  'Orquestacion operativa y seguimiento de pipeline',
];

export default function SiteHomePage() {
  const links = [
    {
      title: 'Sitio publico',
      url: webPublicConfig.urls.site,
      description: 'Landing y contenido comercial del producto.',
    },
    {
      title: 'Sponsors Members',
      url: webPublicConfig.urls.members,
      description: 'Area privada para sponsors y operacion de cuentas.',
    },
    {
      title: 'Panel Admin',
      url: webPublicConfig.urls.admin,
      description: 'Consola de gobierno, catalogos y supervison operativa.',
    },
    {
      title: 'API Controlada',
      url: webPublicConfig.urls.api,
      description: 'Superficie API publica limitada para integraciones.',
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
          Plataforma Leadflow
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
          Shell operativo inicial para captacion y asignacion de leads
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
          Esta fase deja una base lista para evolucion funcional: segmentos
          separados para site, members y admin, mas configuracion por entorno
          para dominios y API.
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
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {links.map((link) => (
          <article
            key={link.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-900">{link.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{link.description}</p>
            <p className="mt-3 break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
              {link.url}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/members"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">Entrar a Members</h2>
          <p className="mt-2 text-sm text-slate-600">
            Navega al shell de area privada de sponsors.
          </p>
        </Link>

        <Link
          href="/admin"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">Entrar a Admin</h2>
          <p className="mt-2 text-sm text-slate-600">
            Navega al shell de operacion administrativa.
          </p>
        </Link>

        <a
          href={`${webPublicConfig.urls.api}/health`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">API Health</h2>
          <p className="mt-2 text-sm text-slate-600">
            Verifica el endpoint de salud del backend.
          </p>
        </a>
      </section>
    </main>
  );
}
