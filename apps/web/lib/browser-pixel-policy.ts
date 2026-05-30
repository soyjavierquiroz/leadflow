export type BrowserPixelTrafficLayer =
  | "DIRECT"
  | "PAID_WHEEL"
  | "PAID_ADS"
  | "ORGANIC"
  | string
  | null
  | undefined;

export type BrowserPixelTrackingConfig = {
  metaPixelId?: string | null;
  tiktokPixelId?: string | null;
};

export const isPaidBrowserPixelTrafficLayer = (
  trafficLayer: BrowserPixelTrafficLayer,
) => trafficLayer === "PAID_ADS" || trafficLayer === "PAID_WHEEL";

export const hasBrowserPixelTrackingConfig = (
  trackingConfig: BrowserPixelTrackingConfig,
) =>
  Boolean(
    trackingConfig.metaPixelId?.trim() || trackingConfig.tiktokPixelId?.trim(),
  );

export const shouldEnableBrowserPixels = (
  trafficLayer: BrowserPixelTrafficLayer,
  trackingConfig: BrowserPixelTrackingConfig,
  policyAllowsBrowserPixels = true,
) =>
  Boolean(
    policyAllowsBrowserPixels &&
      isPaidBrowserPixelTrafficLayer(trafficLayer) &&
      hasBrowserPixelTrackingConfig(trackingConfig),
  );

export const shouldAllowBrowserPixelPolicy = (
  trafficLayer: BrowserPixelTrafficLayer,
  policyAllowsBrowserPixels = true,
) =>
  Boolean(
    policyAllowsBrowserPixels && isPaidBrowserPixelTrafficLayer(trafficLayer),
  );
