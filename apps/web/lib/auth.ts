import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
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
    availabilityStatus: string;
  } | null;
};

type AuthMeResponse = {
  user: AuthenticatedAppUser;
};

const authApiBaseUrl = `${webPublicConfig.urls.api}/v1`;

const buildCookieHeader = async () => {
  const cookieStore = await cookies();
  return cookieStore.toString();
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
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== requiredRole) {
    redirect(getHomePathForRole(user.role));
  }

  return user;
};
