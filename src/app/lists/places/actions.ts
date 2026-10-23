"use server";
import { revalidatePath } from "next/cache";
import { listSession } from "@/lib/data/lists";
import { listId, listText, type ListState } from "@/lib/lists";
import { googleMapsUrl } from "@/lib/user-places";

export async function mutateUserPlace(_previous: ListState, form: FormData): Promise<ListState> {
  try {
    const { client, authenticated } = await listSession();
    if (!authenticated) return { error: "Please sign in to manage your private places." };
    const operation = form.get("operation");
    const id = String(form.get("place_id") ?? "");
    if (operation !== "create" && !listId.test(id)) return { error: "This private place is unavailable. Return to My Places." };
    let result;
    if (operation === "create" || operation === "edit") {
      const category = form.get("category");
      if (category !== "restaurant" && category !== "cafe") return { error: "Choose restaurant or cafe." };
      const fields = { name: listText(form, "name", 120, true)!, category,
        area: listText(form, "area", 160), address: listText(form, "address", 1000),
        google_maps_url: googleMapsUrl(listText(form, "google_maps_url", 2048)), notes: listText(form, "notes", 5000) };
      result = operation === "create" ? await client.from("user_places").insert(fields).select("id").single()
        : await client.from("user_places").update(fields).eq("id", id).select("id").maybeSingle();
    } else if (operation === "delete") {
      if (form.get("confirm") !== "yes") return { error: "Confirm deletion first." };
      result = await client.from("user_places").delete().eq("id", id).select("id").maybeSingle();
    } else return { error: "Unknown place action." };
    if (result.error) return { error: "Unable to save your private place. Please reload and try again." };
    if (!result.data) return { error: "This private place is unavailable. Return to My Places." };
    revalidatePath("/lists", "layout");
    return { success: operation === "delete" ? "Private place deleted from My Places and all your lists." : "Private place saved." };
  } catch (error) {
    return { error: error instanceof Error && /^(Name|Notes|Description|Area|Address|Google Maps|Use a valid|Invalid text)/.test(error.message) ? error.message : "Private places are temporarily unavailable. Please try again." };
  }
}
