export interface UserPlace {
  id: string; name: string; category: "restaurant" | "cafe"; area: string | null;
  address: string | null; google_maps_url: string | null; notes: string | null;
  photo_object_id?: string | null; updated_at?: string;
}
export function googleMapsUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.length > 2048 || /\s/.test(value) || !/^https:\/\/((www\.)?google\.com\/maps([/?#]|$)|maps\.google\.com([/?#]|$)|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)/.test(value)) throw Error("Use a valid HTTPS Google Maps link.");
  try {
    const url = new URL(value);
    const allowed = ((url.hostname === "google.com" || url.hostname === "www.google.com") && /^\/maps(?:[/?#]|$)/.test(url.pathname + url.search + url.hash))
      || url.hostname === "maps.google.com" || url.hostname === "maps.app.goo.gl"
      || (url.hostname === "goo.gl" && url.pathname.startsWith("/maps/"));
    if (url.protocol !== "https:" || url.username || url.password || url.port || !allowed) throw Error();
    return value;
  } catch { throw Error("Use a valid HTTPS Google Maps link."); }
}
