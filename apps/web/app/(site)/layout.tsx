import Link from 'next/link';

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 lg:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              Leadflow
            </p>
            <p className="text-sm text-slate-500">Site publico</p>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" href="/">
              Site
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" href="/members">
              Members
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" href="/admin">
              Admin
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

