"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { TrackedCta } from "@/components/public-funnel/tracked-cta";
import {
  cx,
  stickyBarPrimaryButtonClassName,
} from "@/components/public-funnel/adapters/public-funnel-primitives";

type StickyConversionBarActionConfig = {
  href: string;
  action?: string | null;
};

type StickyConversionBarProps = {
  publicationId: string;
  currentStepId: string;
  currentPath: string;
  desktopText: string;
  desktopButtonText: string;
  mobileButtonText: string;
  triggerOffsetPixels: number;
  isInverted?: boolean;
  /** @deprecated Theme tokens are now the source of truth for bar colors. */
  bgColor?: string;
  /** @deprecated Theme tokens are now the source of truth for bar colors. */
  textColor?: string;
  /** @deprecated Theme tokens are now the source of truth for button colors. */
  buttonBgColor?: string;
  /** @deprecated Theme tokens are now the source of truth for button colors. */
  buttonTextColor?: string;
  /** @deprecated Theme tokens are now the source of truth for border colors. */
  borderColor?: string;
  actionConfig: StickyConversionBarActionConfig;
};

const desktopShellClassName =
  "fixed bottom-0 left-0 z-[99999] hidden w-full py-3 shadow-[var(--theme-section-sticky-bar-shadow)] transition duration-300 md:flex md:items-center md:justify-center";

const mobileShellClassName =
  "fixed bottom-0 left-0 z-[99999] w-full p-4 shadow-[var(--theme-section-sticky-bar-shadow)] transition duration-300 md:hidden";

const defaultShellToneClassName =
  "border-t [background:var(--theme-section-sticky-bar-bg)] [border-color:var(--theme-section-sticky-bar-border)] text-[color:var(--theme-section-sticky-bar-text-color)]";

const invertedShellToneClassName =
  "border-none [background:var(--theme-text-headline-color)] [color:var(--theme-base-canvas)]";

const desktopButtonClassName =
  `${stickyBarPrimaryButtonClassName} w-full animate-pulse cursor-pointer md:w-auto`;

const mobileButtonClassName =
  `${stickyBarPrimaryButtonClassName} w-full animate-pulse cursor-pointer md:w-auto`;

function useStickyVisibility(triggerOffsetPixels: number) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let frameId = 0;

    const syncVisibility = () => {
      setIsVisible(window.scrollY >= Math.max(0, triggerOffsetPixels));
    };

    const handleScroll = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        syncVisibility();
      });
    };

    syncVisibility();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [triggerOffsetPixels]);

  return isVisible;
}

export function StickyConversionBar({
  publicationId,
  currentStepId,
  currentPath,
  desktopText,
  desktopButtonText,
  mobileButtonText,
  triggerOffsetPixels,
  isInverted = false,
  actionConfig,
}: StickyConversionBarProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const isVisible = useStickyVisibility(triggerOffsetPixels);
  const shellToneClassName = isInverted
    ? invertedShellToneClassName
    : defaultShellToneClassName;

  useEffect(() => {
    setIsMounted(true);
    setPortalHost(
      anchorRef.current?.closest<HTMLElement>("[data-funnel-theme]") ?? document.body,
    );
  }, []);

  const renderActionButton = (label: string, className: string) => {
    return (
      <TrackedCta
        publicationId={publicationId}
        currentStepId={currentStepId}
        currentPath={currentPath}
        href={actionConfig.href}
        label={label}
        className={className}
        action={actionConfig.action}
      />
    );
  };

  if (!isMounted || !portalHost) {
    return <div ref={anchorRef} aria-hidden="true" className="hidden" />;
  }

  return (
    <>
      <div ref={anchorRef} aria-hidden="true" className="hidden" />
      {createPortal(
        <>
          <div
            aria-hidden={!isVisible}
            className={cx(
              desktopShellClassName,
              shellToneClassName,
              isVisible
                ? "translate-y-0 opacity-100"
                : "-translate-y-full opacity-0 pointer-events-none",
            )}
          >
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6">
              <p className="max-w-3xl text-sm font-semibold leading-6 text-inherit md:text-base">
                {desktopText}
              </p>
              <div className="shrink-0">
                {renderActionButton(desktopButtonText, desktopButtonClassName)}
              </div>
            </div>
          </div>

          <div
            aria-hidden={!isVisible}
            className={cx(
              mobileShellClassName,
              shellToneClassName,
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-full opacity-0 pointer-events-none",
            )}
          >
            <div className="mx-auto w-full max-w-xl pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)]">
              <div className="w-full">
                {renderActionButton(mobileButtonText, mobileButtonClassName)}
              </div>
            </div>
          </div>
        </>,
        portalHost,
      )}
    </>
  );
}
