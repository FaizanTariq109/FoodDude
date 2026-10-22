export interface PublicBranch {
  id: string;
  restaurant_id: string;
  name: string | null;
  area: string | null;
  address: string | null;
  phone: string | null;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
}
export interface AdminBranch extends PublicBranch {
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Accept direct Google Maps links and its two official short-link formats only.
export function mapsUrl(value: string | null): string | null {
  if (!value || value.length > 2048 || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname;
    if ((["google.com", "www.google.com"].includes(host) && /^\/maps(?:\/|$)/.test(url.pathname)) ||
      host === "maps.google.com" || host === "maps.app.goo.gl" ||
      (host === "goo.gl" && url.pathname.startsWith("/maps/"))) return url.href;
  } catch { /* Invalid links are never rendered. */ }
  return null;
}
export function phoneHref(value: string | null): string | null {
  if (!value || !/^\+?[0-9() .-]{3,40}$/.test(value)) return null;
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length >= 3 ? `tel:${value.startsWith("+") ? "+" : ""}${digits}` : null;
}
