"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listSession } from "@/lib/data/lists";
import { listId, listText, type ListState } from "@/lib/lists";

export async function mutateList(_previous: ListState, form: FormData): Promise<ListState> {
  let destination: string | undefined;
  try {
    const { client, authenticated } = await listSession();
    if (!authenticated) return { error: "Please sign in to manage your private lists." };
    const operation = String(form.get("operation") ?? "");
    const id = String(form.get("list_id") ?? "");
    if (operation !== "create" && !listId.test(id)) return { error: "This list is unavailable. Return to My Lists." };
    let result;
    if (operation === "create" || operation === "edit") {
      const fields = { name: listText(form, "name", 80, true)!, description: listText(form, "description", 1000) };
      result = operation === "create"
        ? await client.from("user_lists").insert(fields).select("id").single()
        : await client.from("user_lists").update(fields).eq("id", id).select("id").maybeSingle();
      if (operation === "create" && result.data) destination = `/lists/${result.data.id}`;
    } else if (operation === "delete") {
      if (form.get("confirm") !== "yes") return { error: "Confirm deletion first." };
      result = await client.from("user_lists").delete().eq("id", id).select("id").maybeSingle();
      if (result.data) destination = "/lists";
    } else if (operation === "add") {
      const restaurant = String(form.get("restaurant_id") ?? "");
      if (!listId.test(restaurant)) return { error: "Choose a public restaurant." };
      result = await client.from("user_list_entries").insert({ list_id: id, restaurant_id: restaurant, notes: listText(form, "notes", 5000) }).select("id").single();
    } else if (operation === "notes" || operation === "remove") {
      const entry = String(form.get("entry_id") ?? "");
      if (!listId.test(entry)) return { error: "This saved restaurant is unavailable." };
      const notes = operation === "notes" ? listText(form, "notes", 5000) : null;
      const query = operation === "notes"
        ? client.from("user_list_entries").update({ notes })
        : client.from("user_list_entries").delete();
      result = await query.eq("id", entry).eq("list_id", id).select("id").maybeSingle();
    } else return { error: "Unknown list action." };
    if (result.error) return { error: result.error.code === "23505" ? "This restaurant is already in that list." : "Unable to save. The list or public restaurant may no longer be available. Please reload and try again." };
    if (!result.data) return { error: "This list or saved restaurant is unavailable. Return to My Lists." };
    revalidatePath("/lists", "layout");
    revalidatePath("/places/[slug]", "page");
  } catch (error) {
    return { error: error instanceof Error && /^(Name|Notes|Description|Invalid text)/.test(error.message) ? error.message : "Lists are temporarily unavailable. Please try again." };
  }
  if (destination) redirect(destination);
  return { success: "Saved to your private lists." };
}
