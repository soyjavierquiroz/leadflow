"use client";

type MemberInlineBannerProps = {
  tone: "success" | "error";
  message: string;
};

const toneClassName = {
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  error: "border-rose-500/25 bg-rose-500/10 text-rose-100",
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
