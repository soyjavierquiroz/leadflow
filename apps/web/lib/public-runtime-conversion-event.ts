"use client";

export const leadCaptureConversionEventName = "CompleteRegistration";

export const toPartialEventId = (eventId: string) =>
  eventId.length <= 12
    ? eventId
    : `${eventId.slice(0, 8)}...${eventId.slice(-4)}`;

export const appendConversionEventIdToPath = (
  path: string | null | undefined,
  eventId: string | null | undefined,
) => {
  const normalizedPath = path?.trim();
  const normalizedEventId = eventId?.trim();

  if (!normalizedPath || !normalizedEventId) {
    return normalizedPath ?? path ?? null;
  }

  try {
    const url = new URL(normalizedPath, "https://leadflow.local");
    url.searchParams.set("event_id", normalizedEventId);

    if (/^https?:\/\//i.test(normalizedPath)) {
      return url.toString();
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const separator = normalizedPath.includes("?") ? "&" : "?";
    return `${normalizedPath}${separator}event_id=${encodeURIComponent(
      normalizedEventId,
    )}`;
  }
};

