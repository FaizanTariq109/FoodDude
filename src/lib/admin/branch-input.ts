import { mapsUrl } from "@/lib/branches";

export function branchInput(form: FormData) {
  const text = (key: string, max: number) => {
    const value = String(form.get(key) ?? "").trim();
    if (value.length > max) throw Error(`${key.replaceAll("_", " ")} is too long (maximum ${max} characters).`);
    return value || null;
  };
  const name = text("name", 200), area = text("area", 200), address = text("address", 1000);
  if (!name && !area && !address) throw Error("Enter a branch name, area or address to identify this location.");
  const coordinate = (key: string, limit: number) => {
    const raw = text(key, 40);
    if (!raw) return null;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) || !Number.isFinite(Number(raw)) || Math.abs(Number(raw)) > limit) throw Error(`Enter a valid ${key} between -${limit} and ${limit}.`);
    return Number(raw);
  };
  const latitude = coordinate("latitude", 90), longitude = coordinate("longitude", 180);
  if ((latitude === null) !== (longitude === null)) throw Error("Enter both coordinates, or leave both blank.");
  const maps = text("google_maps_url", 2048);
  if (maps && !mapsUrl(maps)) throw Error("Use an HTTPS Google Maps link (google.com/maps, maps.google.com, maps.app.goo.gl or goo.gl/maps).");
  return { p_name: name, p_area: area, p_address: address, p_phone: text("phone", 80),
    p_maps: maps, p_latitude: latitude, p_longitude: longitude, p_active: form.get("is_active") === "on" };
}
export function branchError(code?: string) {
  if (code === "42501") return "Administrator permission is required. Sign in again or contact your administrator.";
  if (code === "40001") return "This branch changed since you opened it. Reload the latest branches and review your changes before saving again.";
  if (code === "23505") return "A branch with the same name, area and address already exists for this restaurant. Review active and inactive branches before adding another.";
  if (code === "P0002" || code === "23503") return "The restaurant or branch could not be found. Reload the restaurant.";
  if (["22023", "22P02", "23514", "22003"].includes(code ?? "")) return "Some branch fields are invalid. Review the location, coordinates and Maps link.";
  return "Saving is unavailable. Check the latest branches before retrying; your request may have reached the server.";
}
