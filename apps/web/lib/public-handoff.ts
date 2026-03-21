"use client";

export const normalizeWhatsappPhone = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D+/g, "");
  if (!digits) {
    return null;
  }

  return digits.startsWith("00") ? digits.slice(2) : digits;
};

export const buildWhatsappUrl = (
  phone: string | null,
  message: string | null,
) => {
  if (!phone) {
    return null;
  }

  if (!message) {
    return `https://wa.me/${phone}`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};
