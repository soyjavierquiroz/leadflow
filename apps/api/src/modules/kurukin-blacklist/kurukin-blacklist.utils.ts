const OPT_OUT_KEYWORD_PATTERNS = [
  /\bSTOP\b/i,
  /\bBAJA\b/i,
  /\bNO\s+MAS\b/i,
] as const;

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeKeywordText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

export const detectOptOutKeyword = (
  value: string | null | undefined,
): string | null => {
  const trimmed = readString(value);

  if (!trimmed) {
    return null;
  }

  const normalized = normalizeKeywordText(trimmed);

  for (const pattern of OPT_OUT_KEYWORD_PATTERNS) {
    const match = normalized.match(pattern);

    if (match?.[0]) {
      return match[0];
    }
  }

  return null;
};

export const extractInboundMessageText = (payload: unknown): string | null => {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const message = asRecord(root?.message) ?? asRecord(data?.message);
  const extendedText = asRecord(message?.extendedTextMessage);

  return (
    readString(root?.text) ??
    readString(root?.body) ??
    readString(data?.text) ??
    readString(data?.body) ??
    readString(message?.conversation) ??
    readString(message?.text) ??
    readString(extendedText?.text) ??
    readString(message?.caption) ??
    readString(data?.caption) ??
    null
  );
};

export const extractInboundMessagePhone = (
  payload: unknown,
): string | null => {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const key = asRecord(root?.key) ?? asRecord(data?.key);

  const phoneCandidate =
    readString(root?.phone) ??
    readString(root?.from) ??
    readString(root?.senderPhone) ??
    readString(data?.phone) ??
    readString(data?.from) ??
    readString(data?.senderPhone) ??
    readString(key?.remoteJid) ??
    readString(key?.participant);

  return phoneCandidate?.split('@')[0] ?? null;
};

export const normalizeBlacklistEntries = (payload: unknown) => {
  const root = asRecord(payload);
  const entries = Array.isArray(root)
    ? root
    : Array.isArray(root?.data)
      ? root.data
      : Array.isArray(root?.items)
        ? root.items
        : Array.isArray(root?.entries)
          ? root.entries
          : [];

  return entries
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      id:
        readString(entry?.id) ??
        readString(entry?.entry_id) ??
        readString(entry?.uuid) ??
        null,
      ownerPhone:
        readString(entry?.owner_phone) ??
        readString(entry?.ownerPhone) ??
        null,
      blockedPhone:
        readString(entry?.blocked_phone) ??
        readString(entry?.blockedPhone) ??
        null,
      sourceApp:
        readString(entry?.source_app) ??
        readString(entry?.sourceApp) ??
        null,
      scope: readString(entry?.scope) ?? null,
      reason: readString(entry?.reason) ?? null,
      label: readString(entry?.label) ?? null,
      createdAt:
        readString(entry?.created_at) ??
        readString(entry?.createdAt) ??
        null,
      raw: entry,
    }))
    .filter(
      (
        entry,
      ): entry is {
        id: string | null;
        ownerPhone: string | null;
        blockedPhone: string;
        sourceApp: string | null;
        scope: string | null;
        reason: string | null;
        label: string | null;
        createdAt: string | null;
        raw: Record<string, unknown>;
      } => Boolean(entry.blockedPhone),
    );
};
