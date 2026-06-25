// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemberLinkGalleryClient } from "@/components/member-operations/member-link-gallery-client";
import type { MemberLinkGallery } from "@/lib/member-link-gallery";

const { refresh } = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

vi.mock("@/lib/member-operations", () => ({
  memberOperationRequest: vi.fn(),
}));

const gallery: MemberLinkGallery = {
  advisor: {
    sponsorId: "sponsor-1",
    displayName: "Margarita",
    publicSlug: "margarita-pasos",
    requiresPublicSlug: false,
  },
  vanityShortLink: {
    slug: "margarita-pasos",
    targetUrl: "https://leadflow.kuruk.in/ref/margarita-pasos",
    shortLink: {
      shortUrl: "https://kuruk.in/margarita-pasos",
      shortCode: "margarita-pasos",
      provider: "yourls",
      createdAt: "2026-06-25T00:00:00.000Z",
    },
  },
  links: [],
};

describe("member link gallery", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    refresh.mockReset();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it("labels /ref URLs as personal referral links", () => {
    root = createRoot(container);

    act(() => {
      root.render(<MemberLinkGalleryClient initialGallery={gallery} />);
    });

    expect(container.textContent).toContain("Enlace personal de referido");
    expect(container.textContent).toContain(
      "Úsalo solo si necesitas compartir tu perfil o enlace personal.",
    );
    expect(container.textContent).toContain(
      "https://leadflow.kuruk.in/ref/margarita-pasos",
    );
    expect(container.textContent).not.toContain("Enlace principal");
  });
});
