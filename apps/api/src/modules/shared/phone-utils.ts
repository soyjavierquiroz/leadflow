const KURUKIN_PHONE_REGEX = /^[0-9]+$/;

export const sanitizeToKurukinFormat = (phone: string): string => {
  const sanitized = phone.replace(/\D+/g, '').trim();

  if (!sanitized || !KURUKIN_PHONE_REGEX.test(sanitized)) {
    throw new Error(
      'Phone number must contain at least one digit after Kurukin sanitization.',
    );
  }

  return sanitized;
};

export const sanitizeToKurukinFormatOrNull = (
  phone: string | null | undefined,
): string | null => {
  if (!phone) {
    return null;
  }

  try {
    return sanitizeToKurukinFormat(phone);
  } catch {
    return null;
  }
};

export const isKurukinPhoneFormat = (phone: string | null | undefined) =>
  Boolean(phone && KURUKIN_PHONE_REGEX.test(phone));
