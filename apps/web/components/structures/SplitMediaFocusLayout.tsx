import type { CSSProperties, ReactNode } from "react";

import {
  jakawiPremiumClassNames,
  jakawiPremiumThemeStyle,
} from "@/styles/templates/jakawi-premium";

type SplitMediaFocusLayoutProps = {
  announcementSlot?: ReactNode;
  mediaSlot: ReactNode;
  contentSlot: ReactNode;
  className?: string;
  announcementClassName?: string;
  mediaPanelClassName?: string;
  contentPanelClassName?: string;
  contentInnerClassName?: string;
  style?: CSSProperties;
};

const joinClasses = (...values: Array<string | null | undefined | false>) =>
  values.filter(Boolean).join(" ");

export function SplitMediaFocusLayout({
  announcementSlot,
  mediaSlot,
  contentSlot,
  className,
  announcementClassName,
  mediaPanelClassName,
  contentPanelClassName,
  contentInnerClassName,
  style,
}: SplitMediaFocusLayoutProps) {
  return (
    <div
      className={joinClasses(
        jakawiPremiumClassNames.scope,
        jakawiPremiumClassNames.splitFrame,
        className,
      )}
      style={{ ...jakawiPremiumThemeStyle, ...style }}
    >
      {announcementSlot ? (
        <div
          className={joinClasses(
            "mb-0 w-full lg:col-span-2",
            announcementClassName,
          )}
        >
          {announcementSlot}
        </div>
      ) : null}

      <div
        className={joinClasses(
          "hidden lg:block lg:sticky lg:top-0 lg:h-screen overflow-hidden bg-black",
          mediaPanelClassName,
        )}
      >
        <aside className="flex h-full w-full flex-col items-center justify-start bg-black pt-6 pb-48 lg:pt-8 lg:pb-56">
          {mediaSlot}
        </aside>
      </div>

      <div
        className={joinClasses(
          jakawiPremiumClassNames.contentPanel,
          "lg:pt-0",
          contentPanelClassName,
        )}
      >
        <div
          className={joinClasses(
            jakawiPremiumClassNames.contentInner,
            contentInnerClassName,
          )}
        >
          {contentSlot}
        </div>
      </div>
    </div>
  );
}
