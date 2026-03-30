import { create } from "zustand";
import type {
  AnalyticsConsentState,
  AttributionData,
  MetaCookieName,
  MetaCookieValues,
  MetaURLAttributionParams,
} from "../types";

const ANALYTICS_STORAGE_KEY = "kurukin.analytics.state.v1";
const ANALYTICS_ANONYMOUS_ID_KEY = "kurukin.analytics.anonymous_id.v1";

const DEFAULT_CONSENT: AnalyticsConsentState = {
  status: "unknown",
  gdpr_applies: true,
  ccpa_opt_out: false,
  updated_at: null,
};

const DEFAULT_ATTRIBUTION: AttributionData = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  utm_id: null,
  fbclid: null,
  landing_page: null,
  referrer: null,
  captured_at: null,
};

interface PersistedAnalyticsState {
  consent: AnalyticsConsentState;
  attribution: AttributionData;
  anonymousId: string;
}

export interface AnalyticsStoreState {
  isInitialized: boolean;
  consent: AnalyticsConsentState;
  attribution: AttributionData;
  anonymousId: string;
  cookies: MetaCookieValues;
  initialize: () => void;
  setConsent: (
    next: Partial<Omit<AnalyticsConsentState, "updated_at">> & {
      status: AnalyticsConsentState["status"];
    },
  ) => void;
  hasConsentForTracking: () => boolean;
  captureAttributionFromUrl: (search?: string) => AttributionData;
  syncMetaCookies: () => MetaCookieValues;
  getCookie: (name: MetaCookieName) => string | null;
  setCookie: (name: MetaCookieName, value: string, days?: number) => void;
  clearCookie: (name: MetaCookieName) => void;
}

const isBrowserEnvironment = (): boolean =>
  typeof window !== "undefined" && typeof document !== "undefined";

const normalizeNullable = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeSearch = (search: string): string =>
  search.startsWith("?") ? search : `?${search}`;

const parseUrlAttribution = (search: string): MetaURLAttributionParams => {
  const params = new URLSearchParams(normalizeSearch(search));

  return {
    utm_source: normalizeNullable(params.get("utm_source")),
    utm_medium: normalizeNullable(params.get("utm_medium")),
    utm_campaign: normalizeNullable(params.get("utm_campaign")),
    utm_term: normalizeNullable(params.get("utm_term")),
    utm_content: normalizeNullable(params.get("utm_content")),
    utm_id: normalizeNullable(params.get("utm_id")),
    fbclid: normalizeNullable(params.get("fbclid")),
  };
};

const buildAttributionFromCurrentLocation = (
  search?: string,
): AttributionData => {
  if (!isBrowserEnvironment()) {
    return { ...DEFAULT_ATTRIBUTION };
  }

  const currentSearch = typeof search === "string" ? search : window.location.search;
  const urlData = parseUrlAttribution(currentSearch);
  const fullPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  return {
    ...DEFAULT_ATTRIBUTION,
    ...urlData,
    landing_page: fullPath,
    referrer: normalizeNullable(document.referrer),
    captured_at: new Date().toISOString(),
  };
};

const mergeAttribution = (
  current: AttributionData,
  incoming: AttributionData,
): AttributionData => {
  const hasIncomingSignal = Object.values(incoming).some((value) => value !== null);

  return {
    utm_source: incoming.utm_source ?? current.utm_source,
    utm_medium: incoming.utm_medium ?? current.utm_medium,
    utm_campaign: incoming.utm_campaign ?? current.utm_campaign,
    utm_term: incoming.utm_term ?? current.utm_term,
    utm_content: incoming.utm_content ?? current.utm_content,
    utm_id: incoming.utm_id ?? current.utm_id,
    fbclid: incoming.fbclid ?? current.fbclid,
    landing_page: incoming.landing_page ?? current.landing_page,
    referrer: incoming.referrer ?? current.referrer,
    captured_at: hasIncomingSignal ? new Date().toISOString() : current.captured_at,
  };
};

const safeJsonParse = <T>(raw: string | null): T | null => {
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const savePersistedState = (state: PersistedAnalyticsState): void => {
  if (!isBrowserEnvironment()) {
    return;
  }

  try {
    window.localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(state));
    window.localStorage.setItem(ANALYTICS_ANONYMOUS_ID_KEY, state.anonymousId);
  } catch {
    // Ignore write errors (private mode, storage quota, etc.).
  }
};

const loadPersistedState = (): PersistedAnalyticsState | null => {
  if (!isBrowserEnvironment()) {
    return null;
  }

  const parsed = safeJsonParse<PersistedAnalyticsState>(
    window.localStorage.getItem(ANALYTICS_STORAGE_KEY),
  );

  if (parsed === null) {
    return null;
  }

  if (!parsed.anonymousId || parsed.anonymousId.trim().length === 0) {
    return null;
  }

  return {
    consent: parsed.consent ?? DEFAULT_CONSENT,
    attribution: parsed.attribution ?? DEFAULT_ATTRIBUTION,
    anonymousId: parsed.anonymousId,
  };
};

const createAnonymousId = (): string => {
  const cryptoObject = globalThis.crypto;

  if (typeof cryptoObject !== "undefined" && "randomUUID" in cryptoObject) {
    return cryptoObject.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 12);
  return `anon_${Date.now()}_${randomPart}`;
};

const getOrCreateAnonymousId = (): string => {
  if (!isBrowserEnvironment()) {
    return createAnonymousId();
  }

  const localValue = normalizeNullable(
    window.localStorage.getItem(ANALYTICS_ANONYMOUS_ID_KEY),
  );

  if (localValue !== null) {
    return localValue;
  }

  const created = createAnonymousId();

  try {
    window.localStorage.setItem(ANALYTICS_ANONYMOUS_ID_KEY, created);
  } catch {
    // Ignore write errors.
  }

  return created;
};

const readCookieValue = (name: MetaCookieName): string | null => {
  if (!isBrowserEnvironment()) {
    return null;
  }

  const encodedName = `${name}=`;
  const segments = document.cookie.split("; ");
  const target = segments.find((segment) => segment.startsWith(encodedName));

  if (typeof target !== "string") {
    return null;
  }

  const rawValue = target.substring(encodedName.length);
  return normalizeNullable(decodeURIComponent(rawValue));
};

const writeCookieValue = (
  name: MetaCookieName,
  value: string,
  days = 90,
): void => {
  if (!isBrowserEnvironment()) {
    return;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return;
  }

  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(
    normalized,
  )}; Expires=${expires}; Path=/; SameSite=Lax${secure}`;
};

const deleteCookieValue = (name: MetaCookieName): void => {
  if (!isBrowserEnvironment()) {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax${secure}`;
};

const createMetaFbp = (): string =>
  `fb.1.${Date.now()}.${Math.floor(Math.random() * 10_000_000_000)}`;

const createMetaFbc = (fbclid: string): string => `fb.1.${Date.now()}.${fbclid}`;

const readMetaCookies = (): MetaCookieValues => ({
  _fbp: readCookieValue("_fbp"),
  _fbc: readCookieValue("_fbc"),
});

const persisted = loadPersistedState();
const initialAnonymousId = persisted?.anonymousId ?? getOrCreateAnonymousId();

export const useAnalyticsStore = create<AnalyticsStoreState>((set, get) => ({
  isInitialized: false,
  consent: persisted?.consent ?? DEFAULT_CONSENT,
  attribution: persisted?.attribution ?? DEFAULT_ATTRIBUTION,
  anonymousId: initialAnonymousId,
  cookies: readMetaCookies(),

  initialize: (): void => {
    const anonymousId = getOrCreateAnonymousId();
    const currentCookies = readMetaCookies();

    let nextCookies: MetaCookieValues = currentCookies;

    if (currentCookies._fbp === null) {
      const generatedFbp = createMetaFbp();
      writeCookieValue("_fbp", generatedFbp, 90);
      nextCookies = { ...nextCookies, _fbp: generatedFbp };
    }

    const captured = buildAttributionFromCurrentLocation();
    if (captured.fbclid !== null) {
      const generatedFbc = createMetaFbc(captured.fbclid);
      writeCookieValue("_fbc", generatedFbc, 90);
      nextCookies = { ...nextCookies, _fbc: generatedFbc };
    } else {
      nextCookies = {
        ...nextCookies,
        _fbc: nextCookies._fbc ?? readCookieValue("_fbc"),
      };
    }

    set((state) => {
      const mergedAttribution = mergeAttribution(state.attribution, captured);
      const nextState = {
        isInitialized: true,
        anonymousId,
        cookies: nextCookies,
        attribution: mergedAttribution,
      };

      savePersistedState({
        consent: state.consent,
        attribution: mergedAttribution,
        anonymousId,
      });

      return nextState;
    });
  },

  setConsent: (next): void => {
    set((state) => {
      const updatedConsent: AnalyticsConsentState = {
        ...state.consent,
        ...next,
        updated_at: new Date().toISOString(),
      };

      savePersistedState({
        consent: updatedConsent,
        attribution: state.attribution,
        anonymousId: state.anonymousId,
      });

      return { consent: updatedConsent };
    });
  },

  hasConsentForTracking: (): boolean => {
    const consent = get().consent;
    if (consent.status !== "granted") {
      return false;
    }

    return !consent.ccpa_opt_out;
  },

  captureAttributionFromUrl: (search?: string): AttributionData => {
    const incoming = buildAttributionFromCurrentLocation(search);

    set((state) => {
      const mergedAttribution = mergeAttribution(state.attribution, incoming);

      let nextCookies = state.cookies;
      if (incoming.fbclid !== null) {
        const generatedFbc = createMetaFbc(incoming.fbclid);
        writeCookieValue("_fbc", generatedFbc, 90);
        nextCookies = { ...state.cookies, _fbc: generatedFbc };
      }

      savePersistedState({
        consent: state.consent,
        attribution: mergedAttribution,
        anonymousId: state.anonymousId,
      });

      return { attribution: mergedAttribution, cookies: nextCookies };
    });

    return get().attribution;
  },

  syncMetaCookies: (): MetaCookieValues => {
    const cookies = readMetaCookies();
    let nextCookies = cookies;

    if (cookies._fbp === null) {
      const generatedFbp = createMetaFbp();
      writeCookieValue("_fbp", generatedFbp, 90);
      nextCookies = { ...nextCookies, _fbp: generatedFbp };
    }

    set(() => ({ cookies: nextCookies }));
    return nextCookies;
  },

  getCookie: (name): string | null => readCookieValue(name),

  setCookie: (name, value, days = 90): void => {
    writeCookieValue(name, value, days);
    set((state) => ({
      cookies: {
        ...state.cookies,
        [name]: readCookieValue(name),
      },
    }));
  },

  clearCookie: (name): void => {
    deleteCookieValue(name);
    set((state) => ({
      cookies: {
        ...state.cookies,
        [name]: null,
      },
    }));
  },
}));
