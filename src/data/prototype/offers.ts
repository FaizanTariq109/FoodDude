import type { DayOfWeek, DiscountType, OfferType } from "@/types";

export interface DemoOffer {
  id: string;
  restaurantSlug: string;
  type: OfferType;
  discountType: DiscountType;
  value: number | null;
  label: string;
  bankId?: string;
  cardIds: string[];
  days: DayOfWeek[];
  minimumSpend: number | null;
  cap: number | null;
  startDate: string;
  expiryDate: string;
  branchIds: string[] | null;
  terms: string;
}
const terms = "Illustrative offer only; not verified or redeemable. Example terms: dine-in, one eligible card per bill, cannot be combined with another promotion. Confirm actual terms directly with the restaurant and bank.";
const base = { startDate: "2026-01-01", expiryDate: "2027-12-31", terms, minimumSpend: null, cap: null, branchIds: null };
export const demoOffers: DemoOffer[] = [
  { ...base, id: "demo-fuoco-allied", restaurantSlug: "fuoco", type: "bank", discountType: "percentage", value: 25, label: "25% off", bankId: "allied", cardIds: ["allied-classic"], days: [0, 5, 6], cap: 3000, minimumSpend: 2000, branchIds: ["main"] },
  { ...base, id: "demo-basilico-meezan", restaurantSlug: "basilico-by-sara", type: "bank", discountType: "percentage", value: 30, label: "30% off", bankId: "meezan", cardIds: ["meezan-student"], days: [0, 1, 2, 3, 4, 5, 6], cap: 2500 },
  { ...base, id: "demo-amu-allied", restaurantSlug: "amu", type: "bank", discountType: "percentage", value: 20, label: "20% off", bankId: "allied", cardIds: ["allied-classic"], days: [0, 5, 6], cap: 4000, minimumSpend: 5000 },
  { ...base, id: "demo-basil", restaurantSlug: "basil-bistro", type: "restaurant", discountType: "percentage", value: 15, label: "15% off", cardIds: [], days: [0, 1, 2, 3, 4, 5, 6] },
  { ...base, id: "demo-brewscape", restaurantSlug: "brewscape", type: "bank", discountType: "percentage", value: 20, label: "20% off", bankId: "meezan", cardIds: ["meezan-student"], days: [0, 1, 2, 3, 4, 5, 6], cap: 1000 },
  { ...base, id: "demo-double", restaurantSlug: "double-shot", type: "restaurant", discountType: "other", value: null, label: "Coffee for two", cardIds: [], days: [1, 2, 3, 4], terms: "Demo only: buy one coffee, get one of equal or lower value. Illustrative, unverified and not redeemable." },
  { ...base, id: "demo-jhonny", restaurantSlug: "jhonny-jhugnu", type: "bank", discountType: "fixed", value: 1000, label: "PKR 1,000 off", bankId: "allied", cardIds: ["allied-classic"], days: [0, 1, 2, 3, 4, 5, 6], minimumSpend: 5000 },
  { ...base, id: "demo-fuoco-own", restaurantSlug: "fuoco", type: "restaurant", discountType: "other", value: null, label: "Two for one", cardIds: [], days: [1, 2, 3], branchIds: ["dha"], terms: "Demo only: two selected pizzas for the price of one. DHA example branch. Not an actual restaurant promotion." },
  { ...base, id: "demo-haveli", restaurantSlug: "haveli", type: "bank", discountType: "percentage", value: 25, label: "25% off", bankId: "meezan", cardIds: ["meezan-student"], days: [0, 5, 6], cap: 2000 },
];
export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const daysLabel = (days: DayOfWeek[]) => days.length === 7 ? "Every day" : days.map((day) => dayNames[day]).join(" · ");
export const money = (value: number) => "PKR " + value.toLocaleString("en-PK");
export function isOfferValid(offer: DemoOffer, date: string) {
  const day = new Date(date + "T12:00:00+05:00").getUTCDay() as DayOfWeek;
  return date >= offer.startDate && date <= offer.expiryDate && offer.days.includes(day);
}
