import Link from 'next/link';
import { webPublicConfig } from '@/lib/public-env';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
              Admin
            </p>
            <p className="text-sm text-slate-500">{webPublicConfig.urls.admin}</p>
          </div>
          <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-100" href="/">
            Volver al sitio
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}

