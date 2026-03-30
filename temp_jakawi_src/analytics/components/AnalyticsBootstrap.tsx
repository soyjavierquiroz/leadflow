import { useEffect } from "react";
import { useAnalyticsStore } from "../analytics/store/useAnalyticsStore";

const HISTORY_CHANGE_EVENT = "kurukin:historychange";
const pushStatePatchFlag = "__kurukinAnalyticsPushStatePatched";
const replaceStatePatchFlag = "__kurukinAnalyticsReplaceStatePatched";

const isBrowserEnvironment = (): boolean =>
  typeof window !== "undefined" && typeof document !== "undefined";

const dispatchHistoryChangeEvent = (): void => {
  if (!isBrowserEnvironment()) {
    return;
  }

  window.dispatchEvent(new Event(HISTORY_CHANGE_EVENT));
};

const ensureHistoryPatched = (): void => {
  if (!isBrowserEnvironment()) {
    return;
  }

  const historyRef = window.history as History & {
    [pushStatePatchFlag]?: boolean;
    [replaceStatePatchFlag]?: boolean;
  };

  if (historyRef[pushStatePatchFlag] !== true) {
    const originalPushState = window.history.pushState.bind(window.history);
    window.history.pushState = ((
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ): void => {
      originalPushState(data, unused, url);
      dispatchHistoryChangeEvent();
    }) as History["pushState"];
    historyRef[pushStatePatchFlag] = true;
  }

  if (historyRef[replaceStatePatchFlag] !== true) {
    const originalReplaceState = window.history.replaceState.bind(window.history);
    window.history.replaceState = ((
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ): void => {
      originalReplaceState(data, unused, url);
      dispatchHistoryChangeEvent();
    }) as History["replaceState"];
    historyRef[replaceStatePatchFlag] = true;
  }
};

export const AnalyticsBootstrap = (): null => {
  useEffect(() => {
    if (!isBrowserEnvironment()) {
      return;
    }

    const store = useAnalyticsStore.getState();
    store.initialize();
    store.captureAttributionFromUrl(window.location.search);
    ensureHistoryPatched();

    const handleLocationSignal = (): void => {
      useAnalyticsStore
        .getState()
        .captureAttributionFromUrl(window.location.search);
    };

    window.addEventListener("popstate", handleLocationSignal);
    window.addEventListener("hashchange", handleLocationSignal);
    window.addEventListener(HISTORY_CHANGE_EVENT, handleLocationSignal);

    return () => {
      window.removeEventListener("popstate", handleLocationSignal);
      window.removeEventListener("hashchange", handleLocationSignal);
      window.removeEventListener(HISTORY_CHANGE_EVENT, handleLocationSignal);
    };
  }, []);

  return null;
};
