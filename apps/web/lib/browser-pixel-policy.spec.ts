import { describe, expect, it } from "vitest";
import {
  shouldAllowBrowserPixelPolicy,
  shouldEnableBrowserPixels,
} from "@/lib/browser-pixel-policy";

describe("browser pixel policy", () => {
  it("disables browser pixels for organic publications even when pixels exist", () => {
    expect(
      shouldEnableBrowserPixels(
        "ORGANIC",
        {
          metaPixelId: "meta-pixel-1",
          tiktokPixelId: "tt-pixel-1",
        },
        true,
      ),
    ).toBe(false);
  });

  it("disables browser pixels for direct/ref sponsor traffic even when pixels exist", () => {
    expect(
      shouldEnableBrowserPixels(
        "DIRECT",
        {
          metaPixelId: "meta-pixel-1",
          tiktokPixelId: "tt-pixel-1",
        },
        true,
      ),
    ).toBe(false);
  });

  it("enables browser pixels for paid ads traffic with configured pixels", () => {
    expect(
      shouldEnableBrowserPixels(
        "PAID_ADS",
        {
          metaPixelId: "meta-pixel-1",
          tiktokPixelId: "tt-pixel-1",
        },
        true,
      ),
    ).toBe(true);
  });

  it("enables browser pixels for paid wheel traffic with configured pixels", () => {
    expect(
      shouldEnableBrowserPixels(
        "PAID_WHEEL",
        {
          metaPixelId: "meta-pixel-1",
          tiktokPixelId: null,
        },
        true,
      ),
    ).toBe(true);
  });

  it("disables browser pixels for unknown traffic, denied policy, or missing pixels", () => {
    expect(
      shouldEnableBrowserPixels(
        undefined,
        {
          metaPixelId: "meta-pixel-1",
          tiktokPixelId: null,
        },
        true,
      ),
    ).toBe(false);
    expect(
      shouldEnableBrowserPixels(
        "PAID_ADS",
        {
          metaPixelId: "meta-pixel-1",
          tiktokPixelId: null,
        },
        false,
      ),
    ).toBe(false);
    expect(
      shouldEnableBrowserPixels(
        "PAID_ADS",
        {
          metaPixelId: null,
          tiktokPixelId: null,
        },
        true,
      ),
    ).toBe(false);
  });

  it("keeps legacy entry-context policy paid-only before pixel config is known", () => {
    expect(shouldAllowBrowserPixelPolicy("PAID_ADS", true)).toBe(true);
    expect(shouldAllowBrowserPixelPolicy("PAID_WHEEL", true)).toBe(true);
    expect(shouldAllowBrowserPixelPolicy("ORGANIC", true)).toBe(false);
    expect(shouldAllowBrowserPixelPolicy("DIRECT", true)).toBe(false);
    expect(shouldAllowBrowserPixelPolicy("PAID_ADS", false)).toBe(false);
  });
});
