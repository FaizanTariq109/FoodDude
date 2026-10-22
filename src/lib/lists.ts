export const listId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ListState = { error?: string; success?: string };
export interface UserList { id: string; name: string; description: string | null }
export function listText(form: FormData, key: string, max: number, required = false) {
  const raw = form.get(key);
  if (raw !== null && typeof raw !== "string") throw Error("Invalid text field.");
  const value = (raw ?? "").trim();
  if ((required && !value) || value.length > max) throw Error(`${key === "name" ? "Name" : key === "notes" ? "Notes" : "Description"} must ${required ? `contain 1–${max}` : `contain at most ${max}`} characters.`);
  return value || null;
}
