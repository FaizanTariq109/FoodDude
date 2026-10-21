export type MutationState = { error?: string; savedId?: string };
export const restaurantId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function slugFromName(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200).replace(/-$/, "");
}
export function restaurantInput(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const name = text("name"), slug = text("slug"), category = text("category");
  const description = text("short_description"), price = text("price_level");
  if (!name || name.length > 200) throw Error("Enter a name of 1–200 characters.");
  if (slug.length > 200 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw Error("Use lowercase letters, numbers and single hyphens for the slug.");
  if (!["restaurant", "cafe"].includes(category)) throw Error("Choose restaurant or cafe.");
  if (description.length > 2000) throw Error("Keep the description within 2,000 characters.");
  if (price && !/^[1-4]$/.test(price)) throw Error("Choose a price level from 1 to 4.");
  const url = (key: string) => {
    const value = text(key);
    if (!value) return null;
    if (value.length > 2048 || !/^https?:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^\s\\]*)?$/.test(value)) throw Error("Use a valid http:// or https:// official URL without credentials.");
    try { new URL(value); } catch { throw Error("Enter a valid official URL."); }
    return value;
  };
  return { p_name: name, p_slug: slug, p_category: category, p_description: description || null,
    p_price: price ? Number(price) : null, p_website: url("website_url"), p_instagram: url("instagram_url"), p_active: form.get("is_active") === "on" };
}
export function mutationError(code?: string) {
  if (code === "23505") return "That slug is already in use. Choose another slug.";
  if (code === "40001") return "This restaurant changed since you opened it. Reload the latest record and review your changes before saving again.";
  if (code === "P0002") return "This restaurant could not be found.";
  if (["22023", "22P02", "22007", "22008", "23514"].includes(code ?? "")) return "Some restaurant fields are invalid. Review the form and try again.";
  if (code === "42501") return "Administrator permission is required. Sign in again or contact your administrator.";
  return "Saving is unavailable. Check the latest record before retrying; your request may have reached the server.";
}
