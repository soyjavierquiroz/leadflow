import { apiFetchWithSession } from "@/lib/auth";

export type MemberLinkGallery = {
  advisor: {
    sponsorId: string;
    displayName: string;
    publicSlug: string | null;
    requiresPublicSlug: boolean;
  };
  links: Array<{
    id: string;
    url: string;
    domainHost: string;
    pathPrefix: string;
    funnelName: string;
    funnelCode: string;
    isPrimary: boolean;
  }>;
};

const getErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar tus enlaces.";

export const getMemberLinkGallery = async (): Promise<MemberLinkGallery> => {
  const response = await apiFetchWithSession("/sponsors/me/link-gallery");
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as MemberLinkGallery;
};
