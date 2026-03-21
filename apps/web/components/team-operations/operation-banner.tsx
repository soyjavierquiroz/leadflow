"use client";

type OperationBannerProps = {
  tone: "success" | "error";
  message: string;
};

const toneClassName = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
} satisfies Record<OperationBannerProps["tone"], string>;

export function OperationBanner({ tone, message }: OperationBannerProps) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClassName[tone]}`}>
      {message}
    </div>
  );
}
