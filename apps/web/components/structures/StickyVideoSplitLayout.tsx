import type { ReactNode } from "react";

type StickyVideoSplitLayoutProps = {
  headlineSlot: ReactNode;
  stickyVideo: ReactNode;
  scrollContent: ReactNode;
};

export function StickyVideoSplitLayout({
  headlineSlot,
  stickyVideo,
  scrollContent,
}: StickyVideoSplitLayoutProps) {
  return (
    <section className="px-4 py-6 lg:px-6 lg:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 lg:gap-10">
        <div>{headlineSlot}</div>

        <div className="lg:hidden">
          <div className="w-full">{stickyVideo}</div>
        </div>

        <div className="min-w-0 lg:hidden">{scrollContent}</div>

        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-12">
          <div className="lg:sticky lg:top-8 lg:flex lg:h-[calc(100vh-4rem)] lg:items-center">
            <div className="w-full">{stickyVideo}</div>
          </div>

          <div className="min-w-0">{scrollContent}</div>
        </div>
      </div>
    </section>
  );
}
