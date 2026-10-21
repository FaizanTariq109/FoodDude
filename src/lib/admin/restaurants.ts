import type { RestaurantCategory } from "@/types";

export interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
  category: RestaurantCategory;
  short_description: string | null;
  price_level: number | null;
  instagram_url: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function restaurantFilters(params: SearchParams) {
  return {
    q: typeof params.q === "string" ? params.q.trim().slice(0, 200) : "",
    category: params.category === "restaurant" || params.category === "cafe" ? params.category : "all",
    status: params.status === "active" || params.status === "inactive" ? params.status : "all",
  };
}

export function filterRestaurants(rows: AdminRestaurant[], filters: ReturnType<typeof restaurantFilters>) {
  const query = filters.q.trim().toLowerCase();
  return rows.filter(row => row.name.toLowerCase().includes(query)
    && (filters.category === "all" || row.category === filters.category)
    && (filters.status === "all" || row.is_active === (filters.status === "active")));
}

export function restaurantCounts(rows: AdminRestaurant[]) {
  return {
    total: rows.length,
    restaurants: rows.filter(row => row.category === "restaurant").length,
    cafes: rows.filter(row => row.category === "cafe").length,
    active: rows.filter(row => row.is_active).length,
    inactive: rows.filter(row => !row.is_active).length,
  };
}

export function officialUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
