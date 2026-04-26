import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AppUserRole, AuthenticatedAppUser } from "@/lib/auth.types";
import { webPublicConfig } from "@/lib/public-env";
import {
  getErrorDebugDetails,
  logCriticalSsrError,
} from "@/lib/ssr-debug";
export type { AppUserRole, AuthenticatedAppUser } from "@/lib/auth.types";

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

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const sanitizeServerEnv = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveServerApiOrigin = () => {
  const internalCandidate =
    sanitizeServerEnv(process.env.API_INTERNAL_BASE_URL) ??
    sanitizeServerEnv(process.env.INTERNAL_API_BASE_URL) ??
    sanitizeServerEnv(process.env.NEXT_PRIVATE_API_URL);

  if (internalCandidate) {
    return normalizeBaseUrl(internalCandidate);
  }

  try {
    const apiUrl = new URL(webPublicConfig.urls.api);

    if (apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1") {
      return normalizeBaseUrl(`http://api:${apiUrl.port || "3001"}`);
    }
  } catch {
    return normalizeBaseUrl(webPublicConfig.urls.api);
  }

  return normalizeBaseUrl(webPublicConfig.urls.api);
};

const authApiBaseUrl = `${resolveServerApiOrigin()}/v1`;
const authCookieName =
  process.env.AUTH_COOKIE_NAME?.trim() || "leadflow_session";
const authCookieDomain = webPublicConfig.baseDomain ?? undefined;
const authCookieSecure =
  (process.env.NODE_ENV ?? "development") === "production" ||
  Boolean(authCookieDomain);

export type LoginApiResponse = {
  redirectPath: string;
};

export type ImpersonationApiResponse = {
  success: true;
  message: string;
  redirectPath: string;
  user: AuthenticatedAppUser;
};

export type ImpersonationWithServerSessionResult =
  | {
      ok: true;
      payload: ImpersonationApiResponse;
    }
  | {
      ok: false;
      errorMessage: string;
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
export const IMPERSONATE_REQUEST_TIMEOUT_MS = 10_000;
const REMEMBER_ME_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

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

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAppUserRole = (value: unknown): value is AppUserRole =>
  value === "SUPER_ADMIN" || value === "TEAM_ADMIN" || value === "MEMBER";

const isNullableString = (value: unknown): value is string | null =>
  typeof value === "string" || value === null;

const isAuthenticatedWorkspace = (
  value: unknown,
): value is NonNullable<AuthenticatedAppUser["workspace"]> => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.slug === "string" &&
    isNullableString(value.primaryDomain)
  );
};

const isAuthenticatedTeam = (
  value: unknown,
): value is NonNullable<AuthenticatedAppUser["team"]> => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string"
  );
};

const isAuthenticatedSponsor = (
  value: unknown,
): value is NonNullable<AuthenticatedAppUser["sponsor"]> => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.displayName === "string" &&
    isNullableString(value.email) &&
    typeof value.isActive === "boolean" &&
    typeof value.availabilityStatus === "string"
  );
};

export const isAuthenticatedAppUser = (
  value: unknown,
): value is AuthenticatedAppUser => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.fullName === "string" &&
    typeof value.email === "string" &&
    isAppUserRole(value.role) &&
    isNullableString(value.workspaceId) &&
    isNullableString(value.teamId) &&
    isNullableString(value.sponsorId) &&
    typeof value.homePath === "string" &&
    (value.workspace === null || isAuthenticatedWorkspace(value.workspace)) &&
    (value.team === null || isAuthenticatedTeam(value.team)) &&
    (value.sponsor === null || isAuthenticatedSponsor(value.sponsor))
  );
};

const setAuthSessionCookie = async (sessionCookie: AuthSessionCookie) => {
  const cookieStore = await cookies();

  cookieStore.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.options,
  );
};

const configureLoginSessionCookie = (
  sessionCookie: AuthSessionCookie,
  input: {
    rememberMe: boolean;
  },
): AuthSessionCookie => {
  const sessionOptions = { ...sessionCookie.options };

  delete sessionOptions.expires;
  delete sessionOptions.maxAge;

  return {
    ...sessionCookie,
    options: {
      ...sessionOptions,
      httpOnly: true,
      ...(input.rememberMe
        ? { maxAge: REMEMBER_ME_SESSION_MAX_AGE_SECONDS }
        : {}),
      sameSite: "lax",
      secure: true,
    },
  };
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

export const isHybridOperationalAdmin = (
  user: AuthenticatedAppUser | null | undefined,
) => user?.role === "TEAM_ADMIN" && user.sponsor?.isActive === true;

export const canAccessOperationalView = (
  user: AuthenticatedAppUser | null | undefined,
) =>
  user?.role === "MEMBER" ||
  (user?.role === "TEAM_ADMIN" && user.sponsor?.isActive === true);

export const isLoginApiResponse = (value: unknown): value is LoginApiResponse =>
  isObjectRecord(value) &&
  typeof value.redirectPath === "string" &&
  value.redirectPath.startsWith("/");

export const isImpersonationApiResponse = (
  value: unknown,
): value is ImpersonationApiResponse =>
  isObjectRecord(value) &&
  value.success === true &&
  typeof value.message === "string" &&
  typeof value.redirectPath === "string" &&
  value.redirectPath.startsWith("/") &&
  isAuthenticatedAppUser(value.user);

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

export const getImpersonationErrorMessage = (payload: unknown) =>
  getAuthErrorMessage(payload) ?? "No pudimos iniciar la impersonación.";

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
  rememberMe?: boolean;
}) => {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const rememberMe = input.rememberMe ?? false;
  const loginUrl = getAuthLoginApiUrl();

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
    const response = await fetch(loginUrl, {
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
      if (response.status >= 500) {
        console.error("\n🔥 CRITICAL LOGIN FRONTEND ERROR:\n", {
          apiBaseUrl: authApiBaseUrl,
          email,
          loginUrl,
          payload,
          status: response.status,
          statusText: response.statusText,
        }, "\n");
      }

      return {
        errorMessage: getLoginErrorMessage(payload),
        ok: false as const,
      };
    }

    if (!isLoginApiResponse(payload)) {
      console.error("\n🔥 CRITICAL LOGIN FRONTEND ERROR:\n", {
        apiBaseUrl: authApiBaseUrl,
        email,
        loginUrl,
        payload,
        reason: "INVALID_LOGIN_PAYLOAD",
      }, "\n");

      return {
        errorMessage: "El API devolvió una respuesta de login inválida.",
        ok: false as const,
      };
    }

    const sessionCookie = readAuthSessionCookie(response);

    if (!sessionCookie) {
      console.error("\n🔥 CRITICAL LOGIN FRONTEND ERROR:\n", {
        apiBaseUrl: authApiBaseUrl,
        email,
        loginUrl,
        reason: "MISSING_SESSION_COOKIE",
        setCookieHeaders: response.headers.getSetCookie(),
      }, "\n");

      return {
        errorMessage:
          "El API no devolvió una cookie de sesión válida para completar el login.",
        ok: false as const,
      };
    }

    await setAuthSessionCookie(
      configureLoginSessionCookie(sessionCookie, { rememberMe }),
    );

    return {
      ok: true as const,
      redirectUrl: resolveAuthRedirectTarget(payload.redirectPath),
    };
  } catch (error) {
    console.error("\n🔥 CRITICAL LOGIN FRONTEND ERROR:\n", error, "\n");
    console.error("[loginWithServerSession] request context", {
      apiBaseUrl: authApiBaseUrl,
      email,
      loginUrl,
    });

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

export const impersonateWithServerSession = async (input: {
  targetUserId: string;
}): Promise<ImpersonationWithServerSessionResult> => {
  const targetUserId = input.targetUserId.trim();

  if (!targetUserId) {
    return {
      errorMessage: "No pudimos identificar al asesor a impersonar.",
      ok: false as const,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, IMPERSONATE_REQUEST_TIMEOUT_MS);

  try {
    const response = await apiFetchWithSession(
      `/team/members/${encodeURIComponent(targetUserId)}/impersonate`,
      {
        method: "POST",
        signal: controller.signal,
      },
    );

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return {
        errorMessage: getImpersonationErrorMessage(payload),
        ok: false as const,
      };
    }

    if (!isImpersonationApiResponse(payload)) {
      return {
        errorMessage:
          "El API devolvió una respuesta inválida al iniciar la impersonación.",
        ok: false as const,
      };
    }

    const sessionCookie = readAuthSessionCookie(response);

    if (!sessionCookie) {
      return {
        errorMessage:
          "El API no devolvió una cookie de sesión válida para completar la impersonación.",
        ok: false as const,
      };
    }

    await setAuthSessionCookie(sessionCookie);

    return {
      ok: true as const,
      payload,
    };
  } catch (error) {
    return {
      errorMessage:
        error instanceof Error && error.name === "AbortError"
          ? "La impersonación excedió el tiempo límite del servidor."
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
  const requestUrl = `${authApiBaseUrl}${path}`;

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  try {
    return await fetch(requestUrl, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "apiFetchWithSession",
      requestUrl,
      path,
      method: init?.method ?? "GET",
      apiBaseUrl: authApiBaseUrl,
      hasCookieHeader: Boolean(cookieHeader),
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
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

export const requireOperationalViewUser = async () => {
  const requestHeaders = await headers();

  if (isPublicCanvasRequest(requestHeaders)) {
    if (publicCanvasBypassUser.role !== "MEMBER") {
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

  if (!canAccessOperationalView(user)) {
    redirect(resolveAuthRedirectTarget(getHomePathForRole(user.role)));
  }

  return user;
};
