"use client";

type MemberInlineBannerProps = {
  tone: "success" | "error";
  message: string;
};

const toneClassName = {
  success: "border-app-success-border bg-app-success-bg text-app-success-text",
  error: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
} satisfies Record<MemberInlineBannerProps["tone"], string>;

export function MemberInlineBanner({
  tone,
  message,
}: MemberInlineBannerProps) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClassName[tone]}`}>
      {message}
    </div>
  );
}
