import { restaurantsSeed } from "@/data/restaurants.seed";
import type { PublicRestaurant } from "@/lib/data/restaurants";

export const photos = {
  dining: { src: "/images/prototype/dining-room.jpg", alt: "Illustrative restaurant interior with warm lights and communal tables" },
  table: { src: "/images/prototype/table.jpg", alt: "Illustrative plated food at an intimate dining table" },
  bistro: { src: "/images/prototype/bistro.jpg", alt: "Illustrative leafy bistro interior" },
  cafe: { src: "/images/prototype/cafe.jpg", alt: "Illustrative light-filled cafe with outdoor seating" },
  coffee: { src: "/images/prototype/coffee.jpg", alt: "Illustrative freshly prepared coffee" },
  burger: { src: "/images/prototype/burger.jpg", alt: "Illustrative beef burger with lettuce and tomato" },
  pizza: { src: "/images/prototype/pizza.jpg", alt: "Illustrative freshly baked pizza" },
  pasta: { src: "/images/prototype/pasta.jpg", alt: "Illustrative pasta with tomato sauce" },
};
export type Photo = (typeof photos)[keyof typeof photos];
export interface Enrichment {
  photo: Photo;
  gallery?: Photo[];
  area: string;
  tags: string[];
  note: string;
  liked: string[];
  favorite?: boolean;
  branches: { id: string; area: string; label: string }[];
}
const setting = (photo: Photo, area: string, tags: string[], note: string, liked: string[], favorite = false): Enrichment => ({
  photo, area, tags, note, liked, favorite,
  branches: [{ id: "main", area, label: area + " · example branch" }],
});
// Everything below is illustrative UI content, not factual restaurant information.
export const enrichment: Record<string, Enrichment> = {
  "fuoco": { ...setting(photos.pizza, "Gulberg", ["Italian", "Date night"], "The kind of evening you don't rush. Order something to share.", ["Wood-fired pizza", "A slow dinner"], true), gallery: [photos.pizza, photos.dining, photos.table], branches: [{ id: "main", area: "Gulberg", label: "Gulberg · example branch" }, { id: "dha", area: "DHA", label: "DHA · example branch" }] },
  "basilico-by-sara": setting(photos.pasta, "Gulberg", ["Italian", "Comfort food"], "A bowl of pasta and absolutely no other plans.", ["Creamy Alfredo", "Comfort food"], true),
  "amu": setting(photos.table, "Gulberg", ["Date night", "Fine dining"], "For the evenings that deserve a little extra thought.", ["A long dinner", "Thoughtful plates"], true),
  "basil-bistro": setting(photos.bistro, "DHA", ["Casual", "Outdoor"], "A catch-up spot that feels easy from the first minute.", ["Outdoor seating", "Good conversation"], true),
  "haveli": setting(photos.dining, "Old Lahore", ["Desi", "Rooftop"], "Save this one for a dinner with the whole group.", ["Shared plates", "An evening out"]),
  "jhonny-jhugnu": setting(photos.burger, "DHA", ["Burgers", "Casual"], "A quick bite that turns into a proper catch-up.", ["Beef burger", "Something spicy"], true),
  "kyoto": setting(photos.table, "DHA", ["Asian", "Date night"], "Something different for the group dinner rotation.", ["Shared starters", "A quiet table"]),
  "pret-brasserie": setting(photos.bistro, "Gulberg", ["Brunch", "Casual"], "Slow weekends, good company, one more coffee.", ["Weekend brunch", "A sunny corner"]),
  "oka": setting(photos.table, "Gulberg", ["Asian", "Date night"], "Keep it on the list for the next special evening.", ["Dinner for two"]),
  "steakbox": setting(photos.burger, "Johar Town", ["Steak", "Casual"], "For the friend who already knows what they're ordering.", ["A hearty dinner"]),
  "brewscape": setting(photos.cafe, "DHA", ["Coffee", "Outdoor"], "One coffee somehow becomes an entire afternoon.", ["Great coffee", "Outdoor seating"], true),
  "double-shot": setting(photos.coffee, "Gulberg", ["Coffee", "Dessert"], "Coffee first. Plans later.", ["A flat white", "Something sweet"], true),
  "kafi": setting(photos.cafe, "DHA", ["Coffee", "Casual"], "A small pause in a very busy day.", ["Iced coffee"]),
  "luna": setting(photos.coffee, "Gulberg", ["Coffee", "Dessert"], "Your next late-afternoon coffee break.", ["Coffee and cake"]),
  "red-berry-roasters-the-experience-lab": setting(photos.cafe, "Gulberg", ["Coffee", "Brunch"], "Make room for a second cup.", ["A slow brew"]),
  "cafe-bru": setting(photos.coffee, "DHA", ["Coffee", "Dessert"], "A familiar ritual, a different corner of the city.", ["Coffee", "Dessert"]),
};
export interface Place extends PublicRestaurant {
  position: number;
  demo?: Enrichment;
}
export const places: Place[] = restaurantsSeed.map((seed, index) => ({ ...seed, slug: seed.id, position: index, demo: enrichment[seed.id],
  short_description: null, price_level: null, website_url: null, instagram_url: null }));
/** Only returned records enter the list; demo fields never replace official data. */
export function enrichRestaurants(records: PublicRestaurant[]): Place[] {
  const positions = new Map(restaurantsSeed.map((seed, index) => [seed.id, index]));
  return records.map((record, index) => ({
    id: record.id,
    name: record.name,
    slug: record.slug,
    category: record.category,
    short_description: record.short_description ?? null,
    price_level: record.price_level ?? null,
    website_url: record.website_url ?? null,
    instagram_url: record.instagram_url ?? null,
    // Preserve the illustrative collection order for existing sorting controls.
    position: positions.get(record.slug) ?? restaurantsSeed.length + index,
    demo: enrichment[record.slug],
  }));
}
export const areas = ["Gulberg", "DHA", "Johar Town", "Old Lahore"];
export const tags = [...new Set(Object.values(enrichment).flatMap((item) => item.tags))].sort();
