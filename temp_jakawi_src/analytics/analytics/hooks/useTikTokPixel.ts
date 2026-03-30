import { useCallback, useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    ttq?: {
      _i?: Record<string, unknown>;
      load?: (pixelId: string, options?: Record<string, unknown>) => void;
      page?: () => void;
      track?: (eventName: string, params?: Record<string, unknown>) => void;
      [key: string]: unknown;
    };
    TiktokAnalyticsObject?: string;
  }
}

interface UseTikTokPixelResult {
  isReady: boolean;
  track: (eventName: string, params?: Record<string, unknown>) => void;
}

const isBrowserEnvironment = (): boolean =>
  typeof window !== "undefined" && typeof document !== "undefined";

const normalizePixelId = (value: string | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const injectBaseSnippet = (): void => {
  if (!isBrowserEnvironment()) {
    return;
  }

  if (typeof window.ttq !== "undefined" && typeof window.ttq.load === "function") {
    return;
  }

  ((w: Window, d: Document, t: string) => {
    w.TiktokAnalyticsObject = t;
    const ttq = ((w as unknown as Record<string, unknown>)[t] ||
      []) as unknown as Record<string, unknown>;
    (w as unknown as Record<string, unknown>)[t] = ttq;

    const methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie",
    ];

    const setAndDefer = (obj: Record<string, unknown>, methodName: string): void => {
      obj[methodName] = (...args: unknown[]) => {
        (obj as unknown as unknown[]).push([methodName, ...args]);
      };
    };

    for (let i = 0; i < methods.length; i += 1) {
      setAndDefer(ttq, methods[i]);
    }

    ttq.instance = (pixelId: string) => {
      const instanceQueue =
        ((ttq._i as Record<string, unknown> | undefined)?.[pixelId] as Record<
          string,
          unknown
        >) || [];
      for (let i = 0; i < methods.length; i += 1) {
        setAndDefer(instanceQueue, methods[i]);
      }
      return instanceQueue;
    };

    ttq.load = (pixelId: string, options?: Record<string, unknown>) => {
      const source = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      (ttq._i as Record<string, unknown>)[pixelId] = [];
      ((ttq._i as Record<string, unknown>)[pixelId] as Record<string, unknown>)._u =
        source;
      ttq._t = ttq._t || {};
      (ttq._t as Record<string, unknown>)[pixelId] = Date.now();
      ttq._o = ttq._o || {};
      (ttq._o as Record<string, unknown>)[pixelId] = options || {};

      const script = d.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = `${source}?sdkid=${pixelId}&lib=${t}`;

      const firstScript = d.getElementsByTagName("script")[0];
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      }
    };
  })(window, document, "ttq");
};

export const useTikTokPixel = (pixelId: string | null): UseTikTokPixelResult => {
  const normalizedPixelId = useMemo(() => normalizePixelId(pixelId), [pixelId]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isBrowserEnvironment()) {
      return;
    }

    if (normalizedPixelId === null) {
      setIsReady(false);
      return;
    }

    const hasInstance =
      typeof window.ttq !== "undefined" &&
      typeof window.ttq._i === "object" &&
      window.ttq._i !== null &&
      Boolean(window.ttq._i[normalizedPixelId]);

    if (hasInstance) {
      setIsReady(true);
      return;
    }

    injectBaseSnippet();

    if (window.ttq && typeof window.ttq.load === "function") {
      window.ttq.load(normalizedPixelId);
      if (typeof window.ttq.page === "function") {
        window.ttq.page();
      }
      setIsReady(true);
      return;
    }

    setIsReady(false);
  }, [normalizedPixelId]);

  const track = useCallback(
    (eventName: string, params: Record<string, unknown> = {}): void => {
      if (!isBrowserEnvironment() || !isReady) {
        return;
      }

      if (window.ttq && typeof window.ttq.track === "function") {
        window.ttq.track(eventName, params);
      }
    },
    [isReady],
  );

  return { track, isReady };
};
