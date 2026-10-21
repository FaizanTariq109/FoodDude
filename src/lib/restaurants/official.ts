/** Absolute HTTP(S) links only; never pass stored URL text directly into href. */
export function officialRestaurantUrl(value: string | null): string | null {
  if (!value || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

export function priceLevelLabel(value: number | null): string | null {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= 4
    ? `Price level: ${value} / 4` : null;
}
