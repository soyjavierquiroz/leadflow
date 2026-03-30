import { useEffect, useId, useMemo, useRef, useState } from 'react';
import PhoneInput, {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  type Country,
  type Value as PhoneValue,
} from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { useVisitor } from '../../context/VisitorContext';
import 'react-phone-number-input/style.css';

const SUPPORTED_COUNTRIES = new Set<Country>(getCountries() as Country[]);
const FALLBACK_COUNTRY: Country = 'US';

const PRIORITY_COUNTRIES = [
  'BO',
  'AR',
  'CL',
  'CO',
  'PE',
  'EC',
  'UY',
  'PY',
  'VE',
  'MX',
  'US',
  'ES',
] as const satisfies readonly Country[];

const OTHER_ALLOWED_COUNTRIES = [
  'CA',
  'CR',
  'PA',
  'DO',
  'GT',
  'HN',
  'SV',
  'NI',
  'PR',
  'GB',
  'DE',
  'FR',
  'IT',
  'PT',
  'NL',
  'CH',
  'SE',
  'JP',
  'CN',
  'KR',
  'IN',
  'AU',
  'NZ',
] as const satisfies readonly Country[];

const ALLOWED_COUNTRIES: Country[] = [...PRIORITY_COUNTRIES, ...OTHER_ALLOWED_COUNTRIES].filter((country) =>
  SUPPORTED_COUNTRIES.has(country as Country),
) as Country[];
const ALLOWED_COUNTRY_SET = new Set<Country>(ALLOWED_COUNTRIES);
const PRIORITY_COUNTRY_SET = new Set<Country>(PRIORITY_COUNTRIES);
const OTHER_ALLOWED_COUNTRY_SET = new Set<Country>(OTHER_ALLOWED_COUNTRIES);
const PRIORITY_COUNTRY_ORDER = new Map<Country, number>(
  PRIORITY_COUNTRIES.map((country, index) => [country, index]),
);

interface CountryOption {
  value?: Country | 'divider';
  label: string;
  divider?: boolean;
}

interface CountrySelectProps {
  value?: Country;
  onChange: (value?: Country) => void;
  options: CountryOption[];
  iconComponent: React.ElementType;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

export interface SmartPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  defaultCountry?: Country;
  autoDetectCountry?: boolean;
  locale?: string;
  onCountryChange?: (country: Country) => void;
  onValidityChange?: (isValid: boolean) => void;
}

function normalizeCountry(countryCode?: string): Country {
  if (!countryCode) return FALLBACK_COUNTRY;

  const normalized = countryCode.toUpperCase() as Country;
  return ALLOWED_COUNTRY_SET.has(normalized) ? normalized : FALLBACK_COUNTRY;
}

function normalizeToE164(rawValue: string, country: Country): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('+')) {
    return trimmed;
  }

  try {
    const parsed = parsePhoneNumberFromString(trimmed, country);
    return parsed?.number ?? trimmed;
  } catch {
    return trimmed;
  }
}

function validateE164(value: string, required: boolean): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;

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
        !option.divider && Boolean(option.value) && option.value !== 'divider',
    );

    const priorityOptions = countryOptions
      .filter((option) => PRIORITY_COUNTRY_SET.has(option.value))
      .sort((a, b) => (PRIORITY_COUNTRY_ORDER.get(a.value) ?? 0) - (PRIORITY_COUNTRY_ORDER.get(b.value) ?? 0));

    const otherOptions = countryOptions
      .filter((option) => OTHER_ALLOWED_COUNTRY_SET.has(option.value))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (priorityOptions.length === 0) return otherOptions;
    if (otherOptions.length === 0) return priorityOptions;

    return [...priorityOptions, { divider: true, label: '---', value: 'divider' as const }, ...otherOptions];
  }, [options]);

  const selectedOption = useMemo(() => {
    return reorderedOptions.find((option) => !option.divider && option.value === value);
  }, [reorderedOptions, value]);

  const callingCode = value ? `+${getCountryCallingCode(value)}` : '';

  return (
    <div className="PhoneInputCountry SmartPhoneCountryArea">
      <select
        value={value ?? 'ZZ'}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue === 'ZZ') {
            onChange(undefined);
            return;
          }
          if (nextValue === 'divider') return;

          onChange(nextValue as Country);
        }}
        disabled={disabled || readOnly}
        className={[
          'PhoneInputCountrySelect',
          'absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0',
          className ?? '',
        ]
          .join(' ')
          .trim()}
        style={{
          backgroundColor: 'var(--brand-cardBg)',
          color: 'var(--brand-text)',
        }}
        aria-label="Seleccionar país"
      >
        {reorderedOptions.map((option) => {
          const optionValue = option.divider ? 'divider' : option.value ?? 'ZZ';

          return (
            <option
              key={option.divider ? 'divider' : optionValue}
              value={optionValue}
              disabled={Boolean(option.divider)}
            >
              {option.label}
            </option>
          );
        })}
      </select>

      {value ? <Icon country={value} countryName={selectedOption?.label ?? value} flags={flags} /> : null}

      <span className="SmartPhoneCallingCode" aria-hidden="true">
        {callingCode}
      </span>

      <span className="PhoneInputCountrySelectArrow" aria-hidden="true" />
    </div>
  );
}

export function SmartPhoneInput({
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  name,
  id,
  label,
  placeholder = 'WhatsApp o Teléfono',
  className,
  defaultCountry = FALLBACK_COUNTRY,
  autoDetectCountry = true,
  locale = 'es',
  onCountryChange,
  onValidityChange,
}: SmartPhoneInputProps) {
  const { visitorData, isLoading } = useVisitor();

  const generatedId = useId();
  const inputId = id ?? `smart-phone-input-${generatedId}`;
  const errorId = `${inputId}-error`;

  const normalizedDefaultCountry = normalizeCountry(defaultCountry);

  // Inicialización inteligente: Si el contexto ya tiene el país al montar, lo usamos desde el frame 0.
  const [selectedCountry, setSelectedCountry] = useState<Country>(() => {
    if (autoDetectCountry && visitorData?.country_code) {
      return normalizeCountry(visitorData.country_code);
    }
    return normalizedDefaultCountry;
  });

  const hasManualCountryChangeRef = useRef(false);

  const isPhoneValid = useMemo(() => validateE164(value, required), [value, required]);
  const showAutoInvalidState = !error && value.trim().length > 0 && !isPhoneValid;

  useEffect(() => {
    if (!onValidityChange) return;
    onValidityChange(isPhoneValid);
  }, [isPhoneValid, onValidityChange]);

  useEffect(() => {
    if (!autoDetectCountry || !visitorData?.country_code) return;

    const detectedCountry = normalizeCountry(visitorData.country_code);
    if (detectedCountry === selectedCountry) return;

    // Override agresivo: Si no hay texto en el input, forzamos el autodetect
    const isInputEmpty = !value || value.trim() === '';

    if (isInputEmpty || !hasManualCountryChangeRef.current) {
      setSelectedCountry(detectedCountry);
      onCountryChange?.(detectedCountry);
    }
  }, [autoDetectCountry, onCountryChange, selectedCountry, visitorData?.country_code, value]);

  const phoneInputClasses = [
    'w-full rounded-xl border bg-[var(--brand-cardBg)] transition-all duration-200 overflow-hidden',
    showAutoInvalidState || error
      ? 'border-red-500 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20'
      : 'border-[var(--brand-borderColor)] focus-within:border-[var(--brand-primary)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20',
    disabled ? 'opacity-70' : '',
    '[&_.PhoneInputCountry]:m-0 [&_.PhoneInputCountry]:h-12 [&_.PhoneInputCountry]:min-w-[140px]',
    '[&_.PhoneInputCountry]:border-r [&_.PhoneInputCountry]:border-[var(--brand-borderColor)] [&_.PhoneInputCountry]:bg-[var(--brand-cardBg)]',
    '[&_.PhoneInputCountry]:hover:bg-black/10',
    '[&_.PhoneInputCountry]:px-3 [&_.PhoneInputCountry]:flex [&_.PhoneInputCountry]:items-center [&_.PhoneInputCountry]:gap-2',
    '[&_.PhoneInputCountryIcon]:h-4 [&_.PhoneInputCountryIcon]:w-6 [&_.PhoneInputCountryIcon]:rounded-sm [&_.PhoneInputCountryIcon]:shadow-sm',
    '[&_.SmartPhoneCallingCode]:text-[18px] [&_.SmartPhoneCallingCode]:text-sm [&_.SmartPhoneCallingCode]:font-medium [&_.SmartPhoneCallingCode]:text-[var(--brand-text)]',
    '[&_.PhoneInputCountrySelectArrow]:ml-auto [&_.PhoneInputCountrySelectArrow]:mt-0 [&_.PhoneInputCountrySelectArrow]:h-2.5 [&_.PhoneInputCountrySelectArrow]:w-2.5 [&_.PhoneInputCountrySelectArrow]:opacity-100 [&_.PhoneInputCountrySelectArrow]:border-[var(--brand-text)]',
    '[&_.PhoneInputInput]:h-12 [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:px-4 [&_.PhoneInputInput]:text-base [&_.PhoneInputInput]:text-[var(--brand-text)]',
    '[&_.PhoneInputInput]:placeholder:text-[var(--brand-text)] [&_.PhoneInputInput]:placeholder:opacity-60 [&_.PhoneInputInput]:focus:outline-none',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-[var(--brand-text)]">
          {label}
          {required ? <span className="ml-1 text-red-500">*</span> : null}
        </label>
      ) : null}

      <PhoneInput
        id={inputId}
        flags={flags}
        value={(value as PhoneValue) || undefined}
        onChange={(nextValue) => {
          const next = normalizeToE164((nextValue ?? '') as string, selectedCountry);
          onChange(next);
        }}
        country={selectedCountry}
        onCountryChange={(nextCountry) => {
          const resolved = normalizeCountry(nextCountry);

          // Evitar falso positivo en el render inicial
          if (resolved !== selectedCountry) {
            hasManualCountryChangeRef.current = true;
          }

          setSelectedCountry(resolved);
          onCountryChange?.(resolved);

          if (value.trim() && !value.startsWith('+')) {
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
          autoComplete: 'tel-national',
          inputMode: 'tel',
          disabled,
          placeholder,
          required,
          'aria-invalid': Boolean(error || showAutoInvalidState),
          'aria-describedby': error || showAutoInvalidState ? errorId : undefined,
        }}
        disabled={disabled}
        locale={locale}
        className={phoneInputClasses}
      />

      {autoDetectCountry && isLoading ? (
        <p className="mt-2 text-xs text-[var(--brand-text)] opacity-70">Detectando país por IP...</p>
      ) : null}

      {error ? (
        <p id={errorId} className="mt-2 text-xs text-red-500">
          {error}
        </p>
      ) : null}

      {!error && showAutoInvalidState ? (
        <p id={errorId} className="mt-2 text-xs text-red-500">
          Número inválido.
        </p>
      ) : null}

      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}

export default SmartPhoneInput;
