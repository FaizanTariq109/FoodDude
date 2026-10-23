export const listId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ListState = { error?: string; success?: string; duplicate?: boolean };
export interface UserList { id: string; name: string; description: string | null; kind?: "custom" | "liked" }
export interface ListSummary extends UserList { restaurantCount: number }
export interface ListRestaurant { id: string; name: string; slug: string; category: string; private?: boolean; area?: string | null; photo_object_id?: string | null }
export const placeKey = (place: ListRestaurant) => place.private ? `private:${place.id}` : place.id;
export interface SavedEntry { id: string; restaurant_id: string | null; user_place_id?: string | null; notes: string | null }
export function listText(form: FormData, key: string, max: number, required = false) {
  const raw = form.get(key);
  if (raw !== null && typeof raw !== "string") throw Error("Invalid text field.");
  const value = (raw ?? "").trim();
  const label = ({ name: "Name", notes: "Notes", area: "Area", address: "Address", google_maps_url: "Google Maps URL" } as Record<string, string>)[key] ?? "Description";
  if ((required && !value) || value.length > max) throw Error(`${label} must ${required ? `contain 1–${max}` : `contain at most ${max}`} characters.`);
  return value || null;
}
