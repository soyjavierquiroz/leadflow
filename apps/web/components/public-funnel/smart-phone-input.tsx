"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from "react";
import PhoneInput, {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  type Country,
  type Value as PhoneValue,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { ChevronDown } from "lucide-react";
import { cx } from "@/components/public-funnel/adapters/public-funnel-primitives";
import { useVisitorData } from "@/components/public-funnel/use-visitor-data";
import { jakawiPremiumClassNames } from "@/styles/templates/jakawi-premium";

const SUPPORTED_COUNTRIES = new Set<Country>(getCountries() as Country[]);
const FALLBACK_COUNTRY: Country = "US";

const PRIORITY_COUNTRIES = [
  "BO",
  "AR",
  "CL",
  "CO",
  "PE",
  "EC",
  "UY",
  "PY",
  "VE",
  "MX",
  "US",
  "ES",
] as const satisfies readonly Country[];

const OTHER_ALLOWED_COUNTRIES = [
  "CA",
  "CR",
  "PA",
  "DO",
  "GT",
  "HN",
  "SV",
  "NI",
  "PR",
  "GB",
  "DE",
  "FR",
  "IT",
  "PT",
  "NL",
  "CH",
  "SE",
  "JP",
  "CN",
  "KR",
  "IN",
  "AU",
  "NZ",
] as const satisfies readonly Country[];

const ALLOWED_COUNTRIES: Country[] = [...PRIORITY_COUNTRIES, ...OTHER_ALLOWED_COUNTRIES].filter(
  (country) => SUPPORTED_COUNTRIES.has(country as Country),
) as Country[];

const ALLOWED_COUNTRY_SET = new Set<Country>(ALLOWED_COUNTRIES);
const PRIORITY_COUNTRY_SET = new Set<Country>(PRIORITY_COUNTRIES);
const OTHER_ALLOWED_COUNTRY_SET = new Set<Country>(OTHER_ALLOWED_COUNTRIES);
const PRIORITY_COUNTRY_ORDER = new Map<Country, number>(
  PRIORITY_COUNTRIES.map((country, index) => [country, index]),
);

type CountryOption = {
  value?: Country | "divider";
  label: string;
  divider?: boolean;
};

type CountrySelectProps = {
  value?: Country;
  onChange: (value?: Country) => void;
  options: CountryOption[];
  iconComponent: ElementType;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
};

export type SmartPhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  invalidMessage?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  labelClassName?: string;
  phoneInputClassName?: string;
  defaultCountry?: Country;
  autoDetectCountry?: boolean;
  locale?: string;
  onCountryChange?: (country: Country) => void;
  onValidityChange?: (isValid: boolean) => void;
};

function normalizeCountry(countryCode?: string): Country {
  if (!countryCode) {
    return FALLBACK_COUNTRY;
  }

  const normalized = countryCode.toUpperCase() as Country;
  return ALLOWED_COUNTRY_SET.has(normalized) ? normalized : FALLBACK_COUNTRY;
}

function normalizeToE164(rawValue: string, country: Country) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return trimmed;
  }

  try {
    const parsed = parsePhoneNumberFromString(trimmed, country);
    return parsed?.number ?? trimmed;
  } catch {
    return trimmed;
  }
}

function validateE164(value: string, required: boolean) {
  const trimmed = value.trim();
  if (!trimmed) {
    return !required;
  }

  try {
    return isValidPhoneNumber(trimmed);
  } catch {
    return false;
  }
}

function CountrySelectWithCallingCode({
  value,
  onChange,
  options,
  iconComponent: Icon,
  disabled,
  readOnly,
  className,
}: CountrySelectProps) {
  const reorderedOptions = useMemo(() => {
    const countryOptions = options.filter(
      (option): option is CountryOption & { value: Country } =>
        !option.divider && Boolean(option.value) && option.value !== "divider",
    );

    const priorityOptions = countryOptions
      .filter((option) => PRIORITY_COUNTRY_SET.has(option.value))
      .sort(
        (a, b) =>
          (PRIORITY_COUNTRY_ORDER.get(a.value) ?? 0) -
          (PRIORITY_COUNTRY_ORDER.get(b.value) ?? 0),
      );

    const otherOptions = countryOptions
      .filter((option) => OTHER_ALLOWED_COUNTRY_SET.has(option.value))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (priorityOptions.length === 0) {
      return otherOptions;
    }

    if (otherOptions.length === 0) {
      return priorityOptions;
    }

    return [
      ...priorityOptions,
      { divider: true, label: "---", value: "divider" as const },
      ...otherOptions,
    ];
  }, [options]);

  const selectedOption = useMemo(
    () =>
      reorderedOptions.find(
        (option) => !option.divider && option.value === value,
      ),
    [reorderedOptions, value],
  );

  const callingCode = value ? `+${getCountryCallingCode(value)}` : "";

  return (
    <div className="PhoneInputCountry relative flex h-12 w-fit shrink-0 items-center gap-2 pl-3 pr-2">
      <select
        value={value ?? "ZZ"}
        onChange={(event) => {
          const nextValue = event.target.value;

          if (nextValue === "ZZ") {
            onChange(undefined);
            return;
          }

          if (nextValue === "divider") {
            return;
          }

          onChange(nextValue as Country);
        }}
        disabled={disabled || readOnly}
        className={cx(
          "absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0",
          className,
        )}
        aria-label="Seleccionar país"
      >
        {reorderedOptions.map((option) => {
          const optionValue = option.divider ? "divider" : option.value ?? "ZZ";

          return (
            <option
              key={option.divider ? "divider" : optionValue}
              value={optionValue}
              disabled={Boolean(option.divider)}
            >
              {option.label}
            </option>
          );
        })}
      </select>

      {value ? (
        <Icon country={value} countryName={selectedOption?.label ?? value} flags={flags} />
      ) : null}

      <span className="text-sm font-semibold text-slate-800">{callingCode}</span>
      <ChevronDown
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-slate-400"
      />
      <span aria-hidden="true" className="ml-1 h-6 w-px bg-slate-200" />
    </div>
  );
}

export function SmartPhoneInput({
  value,
  onChange,
  error,
  invalidMessage = "Número inválido.",
  disabled = false,
  required = false,
  name,
  id,
  label,
  placeholder = "Tu número de WhatsApp",
  className,
  labelClassName,
  phoneInputClassName,
  defaultCountry = FALLBACK_COUNTRY,
  autoDetectCountry = true,
  locale = "es",
  onCountryChange,
  onValidityChange,
}: SmartPhoneInputProps) {
  const { isLoading, resolvedCountryCode } = useVisitorData(defaultCountry);
  const generatedId = useId();
  const inputId = id ?? `smart-phone-input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const normalizedDefaultCountry = normalizeCountry(defaultCountry);
  const [selectedCountry, setSelectedCountry] = useState<Country>(() =>
    autoDetectCountry
      ? normalizeCountry(resolvedCountryCode)
      : normalizedDefaultCountry,
  );
  const hasManualCountryChangeRef = useRef(false);

  const isPhoneValid = useMemo(
    () => validateE164(value, required),
    [required, value],
  );
  const showAutoInvalidState = !error && value.trim().length > 0 && !isPhoneValid;

  useEffect(() => {
    if (!onValidityChange) {
      return;
    }

    onValidityChange(isPhoneValid);
  }, [isPhoneValid, onValidityChange]);

  useEffect(() => {
    if (!autoDetectCountry || !resolvedCountryCode) {
      return;
    }

    const detectedCountry = normalizeCountry(resolvedCountryCode);
    if (detectedCountry === selectedCountry) {
      return;
    }

    const isInputEmpty = !value || value.trim() === "";
    if (isInputEmpty || !hasManualCountryChangeRef.current) {
      setSelectedCountry(detectedCountry);
      onCountryChange?.(detectedCountry);
    }
  }, [
    autoDetectCountry,
    onCountryChange,
    resolvedCountryCode,
    selectedCountry,
    value,
  ]);

  return (
    <div className={cx("w-full", className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className={cx(
            "mb-2 block text-sm font-semibold text-slate-800",
            labelClassName,
          )}
        >
          {label}
        </label>
      ) : null}

      <PhoneInput
        id={inputId}
        flags={flags}
        value={(value as PhoneValue) || undefined}
        onChange={(nextValue) => {
          onChange(normalizeToE164((nextValue ?? "") as string, selectedCountry));
        }}
        country={selectedCountry}
        onCountryChange={(nextCountry) => {
          const resolved = normalizeCountry(nextCountry);

          if (resolved !== selectedCountry) {
            hasManualCountryChangeRef.current = true;
          }

          setSelectedCountry(resolved);
          onCountryChange?.(resolved);

          if (value.trim() && !value.startsWith("+")) {
            onChange(normalizeToE164(value, resolved));
          }
        }}
        international={false}
        defaultCountry={selectedCountry}
        countries={ALLOWED_COUNTRIES}
        addInternationalOption={false}
        countrySelectComponent={CountrySelectWithCallingCode}
        smartCaret={false}
        numberInputProps={{
          autoComplete: "tel-national",
          inputMode: "tel",
          disabled,
          placeholder,
          required,
          "aria-invalid": Boolean(error || showAutoInvalidState),
          "aria-describedby": error || showAutoInvalidState ? errorId : undefined,
        }}
        disabled={disabled}
        locale={locale}
        className={cx(
          jakawiPremiumClassNames.phoneInputShell,
          showAutoInvalidState || error
            ? "border-red-500 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-200"
            : jakawiPremiumClassNames.phoneInputValid,
          disabled ? "opacity-70" : "",
          jakawiPremiumClassNames.phoneInputField,
          phoneInputClassName,
        )}
      />

      {autoDetectCountry && isLoading ? (
        <p className="mt-2 text-xs text-slate-400">Detectando país…</p>
      ) : null}

      {error ? (
        <p id={errorId} className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}

      {!error && showAutoInvalidState ? (
        <p id={errorId} className="mt-2 text-xs text-red-600">
          {invalidMessage}
        </p>
      ) : null}

      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
