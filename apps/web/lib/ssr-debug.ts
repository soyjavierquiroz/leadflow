type DebugContext = Record<string, unknown>;

const MAX_PREVIEW_LENGTH = 4_000;

const trimPreview = (value: string) =>
  value.length > MAX_PREVIEW_LENGTH
    ? `${value.slice(0, MAX_PREVIEW_LENGTH)}…`
    : value;

const safePreview = (value: unknown) => {
  try {
    const serialized = JSON.stringify(value);
    return trimPreview(serialized ?? String(value));
  } catch (error) {
    return `<<unserializable: ${
      error instanceof Error ? error.message : "unknown error"
    }>>`;
  }
};

export const getErrorDebugDetails = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    value: error,
  };
};

export const logCriticalSsrError = (
  error: unknown,
  context?: DebugContext,
) => {
  console.error(
    "\n🔥 CRITICAL SSR ERROR DETECTED:\n",
    error,
    "\n🔥 END ERROR\n",
  );

  if (context) {
    console.error("[SSR DEBUG CONTEXT]", context);
  }
};

export const readResponseBodyPreview = async (response: Response) => {
  try {
    const rawBody = await response.clone().text();
    return trimPreview(rawBody);
  } catch (error) {
    return `<<unavailable: ${
      error instanceof Error ? error.message : "unknown error"
    }>>`;
  }
};

export const buildResponseDebugContext = async (
  response: Response,
  context?: DebugContext,
) => ({
  ...(context ?? {}),
  status: response.status,
  statusText: response.statusText,
  url: response.url,
  bodyPreview: await readResponseBodyPreview(response),
});

export const describePayloadShape = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return {
      kind: "array",
      length: payload.length,
      firstItemPreview: safePreview(payload[0] ?? null),
    };
  }

  if (payload && typeof payload === "object") {
    return {
      kind: "object",
      keys: Object.keys(payload as Record<string, unknown>),
      preview: safePreview(payload),
    };
  }

  return {
    kind: typeof payload,
    preview: trimPreview(String(payload)),
  };
};
