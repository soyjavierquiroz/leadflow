const KURUKIN_PHONE_REGEX = /^[0-9]+$/;

export const sanitizeToKurukinFormat = (phone: string) => {
  const sanitized = phone.replace(/\D+/g, "").trim();

  if (!sanitized || !KURUKIN_PHONE_REGEX.test(sanitized)) {
    throw new Error(
      "El número debe contener solo dígitos después de la sanitización Kurukin.",
    );
  }

  return sanitized;
};

export const validateKurukinPhone = (phone: string) => {
  try {
    return {
      ok: true as const,
      value: sanitizeToKurukinFormat(phone),
      error: null,
    };
  } catch (error) {
    return {
      ok: false as const,
      value: null,
      error:
        error instanceof Error
          ? error.message
          : "No pudimos validar el número.",
    };
  }
};
