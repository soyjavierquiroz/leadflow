const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const compactNumberFormatter = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "Sin fecha";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return dateFormatter.format(parsed);
};

export const formatCompactNumber = (value: number) =>
  compactNumberFormatter.format(value);

export const toSentenceCase = (value: string | null | undefined) => {
  if (!value) {
    return "Sin estado";
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
};

export const buildInitials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
