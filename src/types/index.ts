/**
 * Domain models, not generated Supabase row/insert types.
 * Future adapters translate snake_case SQL to camelCase here.
 * Database nulls stay null; unloaded relationships are not empty lists.
 */
export type UUID = string;
export type ISODate = string; // YYYY-MM-DD; Lahore calendar date for offers.
export type ISODateTime = string; // ISO 8601 with timezone/UTC offset.
export type Decimal = string; // Preserve PostgreSQL numeric precision.
export type RestaurantCategory = "restaurant" | "cafe";
export type OfferType = "bank" | "restaurant";
export type DiscountType = "percentage" | "fixed" | "other";
export type RecommendationType = "food" | "drink" | "ambience" | "service" | "general";
export type ScrapeRunStatus = "running" | "success" | "partial" | "failed";
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday = 0.
export type NonEmptyArray<T> = readonly [T, ...T[]];

interface Timestamps {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Legacy local seed IDs are slugs, NOT database UUIDs. */
export interface RestaurantSeed {
  id: string;
  name: string;
  category: RestaurantCategory;
}

export interface Restaurant extends Timestamps {
  id: UUID;
  name: string;
  slug: string;
  category: RestaurantCategory;
  shortDescription: string | null;
  personalNotes: string | null;
  priceLevel: 1 | 2 | 3 | 4 | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  isFavorite: boolean;
  isActive: boolean;
}

export interface RestaurantBranch extends Timestamps {
  id: UUID;
  restaurantId: UUID;
  name: string | null;
  area: string | null;
  address: string | null;
  latitude: Decimal | null;
  longitude: Decimal | null;
  googleMapsUrl: string | null;
  phone: string | null;
  isActive: boolean;
}

interface RestaurantImageBase {
  id: UUID;
  restaurantId: UUID;
  branchId: UUID | null;
  altText: string | null;
  sortOrder: number;
  isCover: boolean;
  createdAt: ISODateTime;
}

export type RestaurantImage = RestaurantImageBase & (
  | { storagePath: string; imageUrl: null }
  | { storagePath: null; imageUrl: string }
);

export interface RestaurantRecommendation extends Timestamps {
  id: UUID;
  restaurantId: UUID;
  title: string;
  note: string | null;
  recommendationType: RecommendationType;
}

export interface Tag extends Timestamps {
  id: UUID;
  name: string;
  slug: string;
}

export interface RestaurantTag {
  restaurantId: UUID;
  tagId: UUID;
}

export interface Bank extends Timestamps {
  id: UUID;
  name: string;
  slug: string;
  logoPath: string | null;
  websiteUrl: string | null;
  isActive: boolean;
}

export interface BankCard extends Timestamps {
  id: UUID;
  bankId: UUID;
  name: string;
  slug: string;
  cardNetwork: string | null;
  cardType: string | null;
  cardTier: string | null;
  isActive: boolean;
}

export type BranchApplicability =
  | { scope: "all" }
  | { scope: "selected"; branchIds: NonEmptyArray<UUID> };

export type WeekdayApplicability =
  | { scope: "every_day" }
  | { scope: "selected"; days: NonEmptyArray<DayOfWeek> };

export type CardEligibility =
  | { scope: "all_bank_cards" }
  | { scope: "selected_cards"; cardIds: NonEmptyArray<UUID> };

interface OfferBase extends Timestamps {
  id: UUID;
  restaurantId: UUID;
  title: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: Decimal | null;
  minimumSpend: Decimal | null;
  maximumDiscount: Decimal | null;
  currency: string;
  startDate: ISODate | null;
  expiryDate: ISODate | null;
  terms: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  lastVerifiedAt: ISODateTime | null;
  branchApplicability: BranchApplicability;
  weekdayApplicability: WeekdayApplicability;
  scrapeSourceId: UUID | null;
  lastScrapeRunId: UUID | null;
  externalReference: string | null;
  sourceHash: string | null;
  isActive: boolean;
}

/** Fully hydrated offer: load eligibility junctions before constructing this. */
export type Offer = OfferBase & (
  | { offerType: "bank"; bankId: UUID; cardEligibility: CardEligibility }
  | { offerType: "restaurant"; bankId: null; cardEligibility: null }
);

export interface ScrapeSource extends Timestamps {
  id: UUID;
  bankId: UUID | null;
  name: string;
  sourceUrl: string;
  scraperKey: string;
  isActive: boolean;
}

interface ScrapeRunBase {
  id: UUID;
  scrapeSourceId: UUID;
  startedAt: ISODateTime;
  offersFound: number;
  offersCreated: number;
  offersUpdated: number;
  errorMessage: string | null;
}

export type ScrapeRun = ScrapeRunBase & (
  | { status: "running"; completedAt: null }
  | { status: Exclude<ScrapeRunStatus, "running">; completedAt: ISODateTime }
);
