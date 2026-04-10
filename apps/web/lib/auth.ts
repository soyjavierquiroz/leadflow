import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { webPublicConfig } from "@/lib/public-env";

export type AppUserRole = "SUPER_ADMIN" | "TEAM_ADMIN" | "MEMBER";

export type AuthenticatedAppUser = {
  id: string;
  fullName: string;
  email: string;
  role: AppUserRole;
  workspaceId: string | null;
  teamId: string | null;
  sponsorId: string | null;
  homePath: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    primaryDomain: string | null;
  } | null;
  team: {
    id: string;
    name: string;
    code: string;
  } | null;
  sponsor: {
    id: string;
    displayName: string;
    email: string | null;
    isActive: boolean;
    availabilityStatus: string;
  } | null;
};

type AuthMeResponse = {
  user: AuthenticatedAppUser;
};

type AuthSessionCookie = {
  name: string;
  options: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
  };
  value: string;
};

const authApiBaseUrl = `${webPublicConfig.urls.api}/v1`;
const authCookieName =
  process.env.AUTH_COOKIE_NAME?.trim() || "leadflow_session";
const authCookieDomain = webPublicConfig.baseDomain ?? undefined;
const authCookieSecure =
  (process.env.NODE_ENV ?? "development") === "production" ||
  Boolean(authCookieDomain);

export type LoginApiResponse = {
  redirectPath: string;
};

const publicCanvasPathPrefix = "/sandbox";
const publicCanvasBypassHeader = "x-leadflow-public-canvas-bypass";
const publicCanvasBypassUser: AuthenticatedAppUser = {
  id: "public-canvas-super-admin",
  fullName: "Leadflow Sandbox",
  email: "sandbox@leadflow.local",
  role: "SUPER_ADMIN",
  workspaceId: "workspace-leadflow-sandbox",
  teamId: null,
  sponsorId: null,
  homePath: "/admin",
  workspace: {
    id: "workspace-leadflow-sandbox",
    name: "Leadflow Sandbox Workspace",
    slug: "leadflow-sandbox",
    primaryDomain: "localhost",
  },
  team: null,
  sponsor: null,
};

export const LOGIN_REQUEST_TIMEOUT_MS = 10_000;
export const LOGOUT_REQUEST_TIMEOUT_MS = 10_000;

const buildCookieHeader = async () => {
  const cookieStore = await cookies();
  return cookieStore.toString();
};

const getStringAttributeValue = (attribute: string) => {
  const separatorIndex = attribute.indexOf("=");

  if (separatorIndex === -1) {
    return null;
  }

  return attribute.slice(separatorIndex + 1).trim();
};

const readAuthSessionCookie = (
  response: Response,
  input?: {
    allowEmptyValue?: boolean;
  },
): AuthSessionCookie | null => {
  const setCookieHeaders = response.headers.getSetCookie();
  const allowEmptyValue = input?.allowEmptyValue ?? false;

  for (const header of setCookieHeaders) {
    const parts = header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);

    const [nameValue, ...attributes] = parts;

    if (!nameValue) {
      continue;
    }

    const nameSeparatorIndex = nameValue.indexOf("=");

    if (nameSeparatorIndex === -1) {
      continue;
    }

    const name = nameValue.slice(0, nameSeparatorIndex).trim();
    const value = nameValue.slice(nameSeparatorIndex + 1);

    if (name !== authCookieName || (!allowEmptyValue && !value)) {
      continue;
    }

    const options: {
      domain?: string;
      expires?: Date;
      httpOnly?: boolean;
      maxAge?: number;
      path: string;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
    } = {
      path: "/",
    };

    for (const attribute of attributes) {
      const normalizedAttribute = attribute.toLowerCase();

      if (normalizedAttribute === "httponly") {
        options.httpOnly = true;
        continue;
      }

      if (normalizedAttribute === "secure") {
        options.secure = true;
        continue;
      }

      if (normalizedAttribute.startsWith("domain=")) {
        options.domain = getStringAttributeValue(attribute) ?? undefined;
        continue;
      }

      if (normalizedAttribute.startsWith("path=")) {
        options.path = getStringAttributeValue(attribute) ?? "/";
        continue;
      }

      if (normalizedAttribute.startsWith("max-age=")) {
        const parsedMaxAge = Number(getStringAttributeValue(attribute));

        if (Number.isFinite(parsedMaxAge)) {
          options.maxAge = parsedMaxAge;
        }

        continue;
      }

      if (normalizedAttribute.startsWith("expires=")) {
        const rawExpiresAt = getStringAttributeValue(attribute);

        if (!rawExpiresAt) {
          continue;
        }

        const expiresAt = new Date(rawExpiresAt);

        if (!Number.isNaN(expiresAt.getTime())) {
          options.expires = expiresAt;
        }

        continue;
      }

      if (normalizedAttribute.startsWith("samesite=")) {
        const rawSameSite = getStringAttributeValue(attribute)?.toLowerCase();

        if (
          rawSameSite === "lax" ||
          rawSameSite === "strict" ||
          rawSameSite === "none"
        ) {
          options.sameSite = rawSameSite;
        }
      }
    }

    return {
      name,
      options: {
        ...options,
        domain: options.domain ?? authCookieDomain,
        secure: options.secure ?? authCookieSecure,
      },
      value,
    };
  }

  return null;
};

const setAuthSessionCookie = async (sessionCookie: AuthSessionCookie) => {
  const cookieStore = await cookies();

  cookieStore.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.options,
  );
};

const clearAuthSessionCookie = async (
  sessionCookieOptions?: Partial<AuthSessionCookie["options"]>,
) => {
  const cookieStore = await cookies();

  cookieStore.set(authCookieName, "", {
    domain: sessionCookieOptions?.domain ?? authCookieDomain,
    expires: new Date(0),
    httpOnly: sessionCookieOptions?.httpOnly ?? true,
    maxAge: 0,
    path: sessionCookieOptions?.path ?? "/",
    sameSite: sessionCookieOptions?.sameSite ?? "lax",
    secure: sessionCookieOptions?.secure ?? authCookieSecure,
  });
};

export const getHomePathForRole = (role: AppUserRole) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "TEAM_ADMIN":
      return "/team";
    case "MEMBER":
      return "/member";
  }
};

export const isLoginApiResponse = (value: unknown): value is LoginApiResponse =>
  typeof value === "object" &&
  value !== null &&
  "redirectPath" in value &&
  typeof value.redirectPath === "string" &&
  value.redirectPath.startsWith("/");

const getAuthErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ??
  (typeof payload === "object" &&
  payload !== null &&
  "error" in payload &&
  typeof payload.error === "string"
    ? payload.error
    : null);

export const getLoginErrorMessage = (payload: unknown) =>
  getAuthErrorMessage(payload) ?? "No pudimos iniciar sesión.";

export const getLogoutErrorMessage = (payload: unknown) =>
  getAuthErrorMessage(payload) ?? "No pudimos cerrar la sesión.";

const isPublicCanvasPath = (pathname: string | null) =>
  typeof pathname === "string" && pathname.startsWith(publicCanvasPathPrefix);

const isPublicCanvasRequest = (requestHeaders: Headers) =>
  requestHeaders.get(publicCanvasBypassHeader) === "1" ||
  isPublicCanvasPath(requestHeaders.get("next-url")) ||
  isPublicCanvasPath(requestHeaders.get("x-matched-path"));

export const resolveAuthRedirectTarget = (redirectPath: string) => {
  return new URL(redirectPath, webPublicConfig.urls.site).toString();
};

export const getAuthLoginApiUrl = () => `${authApiBaseUrl}/auth/login`;

export const loginWithServerSession = async (input: {
  email: string;
  password: string;
}) => {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return {
      errorMessage: "Ingresa tu email y password para continuar.",
      ok: false as const,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, LOGIN_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(getAuthLoginApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return {
        errorMessage: getLoginErrorMessage(payload),
        ok: false as const,
      };
    }

    if (!isLoginApiResponse(payload)) {
      return {
        errorMessage: "El API devolvió una respuesta de login inválida.",
        ok: false as const,
      };
    }

    const sessionCookie = readAuthSessionCookie(response);

    if (!sessionCookie) {
      return {
        errorMessage:
          "El API no devolvió una cookie de sesión válida para completar el login.",
        ok: false as const,
      };
    }

    await setAuthSessionCookie(sessionCookie);

    return {
      ok: true as const,
      redirectUrl: resolveAuthRedirectTarget(payload.redirectPath),
    };
  } catch (error) {
    return {
      errorMessage:
        error instanceof Error && error.name === "AbortError"
          ? "El login excedió el tiempo límite del servidor."
          : "No pudimos conectar con el API de autenticación.",
      ok: false as const,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const logoutWithServerSession = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, LOGOUT_REQUEST_TIMEOUT_MS);

  try {
    const response = await apiFetchWithSession("/auth/logout", {
      method: "POST",
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return {
        errorMessage: getLogoutErrorMessage(payload),
        ok: false as const,
      };
    }

    const sessionCookie = readAuthSessionCookie(response, {
      allowEmptyValue: true,
    });

    await clearAuthSessionCookie(sessionCookie?.options);

    return {
      ok: true as const,
    };
  } catch (error) {
    return {
      errorMessage:
        error instanceof Error && error.name === "AbortError"
          ? "El logout excedió el tiempo límite del servidor."
          : "No pudimos conectar con el API de autenticación.",
      ok: false as const,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const apiFetchWithSession = async (path: string, init?: RequestInit) => {
  const cookieHeader = await buildCookieHeader();
  const headers = new Headers(init?.headers);

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  return fetch(`${authApiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
};

export const getSessionUser = async () => {
  noStore();
  const cookieHeader = await buildCookieHeader();

  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await apiFetchWithSession("/auth/me");

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AuthMeResponse;
    return payload.user;
  } catch {
    return null;
  }
};

export const requireRole = async (requiredRole: AppUserRole) => {
  const requestHeaders = await headers();

  if (isPublicCanvasRequest(requestHeaders)) {
    if (publicCanvasBypassUser.role !== requiredRole) {
      redirect(
        resolveAuthRedirectTarget(getHomePathForRole(publicCanvasBypassUser.role)),
      );
    }

    return publicCanvasBypassUser;
  }

  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== requiredRole) {
    redirect(resolveAuthRedirectTarget(getHomePathForRole(user.role)));
  }

  return user;
};
