const trimOuterSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

const normalizeHost = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split("/")[0]
    ?.split("?")[0]
    ?.split("#")[0]
    ?.replace(/:\d+$/, "")
    .replace(/\.+$/, "") ?? "";

export const isPlatformPublicationHost = (host: string) =>
  normalizeHost(host) === "leadflow.kuruk.in";

export const getCustomDomainPathSuggestion = (input: {
  currentPathPrefix: string;
  selectedDomainHost: string | null | undefined;
}) => {
  if (!input.selectedDomainHost || isPlatformPublicationHost(input.selectedDomainHost)) {
    return null;
  }

  const segments = trimOuterSlashes(input.currentPathPrefix)
    .split("/")
    .filter(Boolean);

  if (segments[0] !== "u" || segments.length < 2) {
    return null;
  }

  const remainingPath = segments.slice(2).join("/");

  return remainingPath ? `/${remainingPath}` : "/";
};
