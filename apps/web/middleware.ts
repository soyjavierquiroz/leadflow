import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const normalizeHostname = (value: string | null) =>
  (value ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.+$/, '');

const readHostnameFromUrl = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  try {
    return normalizeHostname(new URL(value).host);
  } catch {
    return normalizeHostname(value);
  }
};

const internalHosts = new Set(
  [
    process.env.NEXT_PUBLIC_APP_BASE_DOMAIN,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_MEMBERS_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL,
    'localhost',
    '127.0.0.1',
  ]
    .map((value) => readHostnameFromUrl(value))
    .filter((value): value is string => Boolean(value)),
);

export function middleware(request: NextRequest) {
  const hostname = normalizeHostname(request.headers.get('host'));
  const { pathname } = request.nextUrl;

  if (!hostname || internalHosts.has(hostname) || pathname.startsWith('/runtime/')) {
    return NextResponse.next();
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname =
    pathname === '/' ? `/runtime/${hostname}` : `/runtime/${hostname}${pathname}`;

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
