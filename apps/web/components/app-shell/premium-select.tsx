"use client";

import { Check, ChevronDown } from "lucide-react";

export type PremiumSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type PremiumSelectProps = {
  id: string;
  value: string;
  placeholder: string;
  options: readonly PremiumSelectOption[];
  open: boolean;
  disabled?: boolean;
  className?: string;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
};

const triggerClassName =
  "flex w-full min-w-52 items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-card px-4 py-2.5 text-left text-sm text-app-text outline-none transition hover:border-app-border-strong hover:bg-app-surface-muted focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";

export function PremiumSelect({
  id,
  value,
  placeholder,
  options,
  open,
  disabled,
  className,
  onOpenChange,
  onValueChange,
}: PremiumSelectProps) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className={triggerClassName}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {selectedOption?.label ?? placeholder}
          </span>
          {selectedOption?.description ? (
            <span className="mt-1 block truncate text-xs font-normal text-app-text-soft">
              {selectedOption.description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-app-text-soft transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-app-border bg-app-card p-1 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onValueChange(option.value);
                  onOpenChange(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-app-text transition hover:bg-app-surface-muted focus:bg-app-surface-muted focus:outline-none"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="mt-1 block truncate text-xs text-app-text-soft">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {isSelected ? (
                  <Check className="h-4 w-4 shrink-0 text-app-accent" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
