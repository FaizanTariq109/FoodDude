import { demoOffers, isOfferValid, type DemoOffer } from "@/data/prototype/offers";
import { places, type Place } from "@/data/prototype/restaurants";

export interface Filters {
  q: string; category: string; area: string; tag: string; bank: string; card: string;
  min: string; today: boolean; liked: boolean; type: string; day: string; sort: string;
}
export const defaultFilters: Filters = { q: "", category: "", area: "", tag: "", bank: "", card: "", min: "", today: false, liked: false, type: "", day: "", sort: "recommended" };
export function parseFilters(params: URLSearchParams): Filters {
  const result = { ...defaultFilters };
  for (const key of Object.keys(defaultFilters) as (keyof Filters)[]) {
    if (key === "today" || key === "liked") result[key] = params.get(key) === "true";
    else result[key] = params.get(key) ?? defaultFilters[key];
  }
  return result;
}
export function filtersQuery(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value !== defaultFilters[key as keyof Filters]) params.set(key, String(value));
  return params.toString();
}
export function offerMatches(offer: DemoOffer, filters: Filters, date: string | null) {
  return (!filters.bank || offer.bankId === filters.bank)
    && (!filters.card || filters.card.split(",").some(card => offer.cardIds.includes(card)))
    && (!filters.type || offer.type === filters.type)
    && (!filters.min || (offer.discountType === "percentage" && (offer.value ?? 0) >= Number(filters.min)))
    && (!filters.today || (!!date && isOfferValid(offer, date)))
    && (!filters.day || offer.days.includes(Number(filters.day) as 0|1|2|3|4|5|6))
    && (!filters.area || offer.branchIds === null || places.find(p => p.slug === offer.restaurantSlug)?.demo?.branches.some(b => offer.branchIds?.includes(b.id) && b.area === filters.area));
}
export function placeMatches(place: Place, filters: Filters, favorites: string[]) {
  const query = filters.q.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  return place.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(query)
    && (!filters.category || place.category === filters.category)
    && (!filters.area || place.demo?.branches.some(branch => branch.area === filters.area))
    && (!filters.tag || place.demo?.tags.includes(filters.tag))
    && (!filters.liked || favorites.includes(place.slug));
}
export function filterPlaces(filters: Filters, date: string | null, favorites: string[], source: Place[] = places) {
  const requiresOffer = filters.bank || filters.card || filters.min || filters.today || filters.type || filters.day;
  return source.filter(place => placeMatches(place, filters, favorites) && (!requiresOffer || demoOffers.some(offer => offer.restaurantSlug === place.slug && offerMatches(offer, filters, date))))
    .sort((a, b) => {
      if (filters.sort === "az") return a.name.localeCompare(b.name);
      // Seed order is collection order, not an invented factual added-at date.
      if (filters.sort === "recent") return b.position - a.position;
      if (filters.sort === "discount") {
        const best = (p: Place) => Math.max(0, ...demoOffers.filter(o => o.restaurantSlug === p.slug && o.discountType === "percentage" && offerMatches(o, filters, date)).map(o => o.value ?? 0));
        return best(b) - best(a) || a.name.localeCompare(b.name);
      }
      return Number(!!b.demo) - Number(!!a.demo) || a.position - b.position;
    });
}
