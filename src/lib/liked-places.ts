export interface LikedPlacesSnapshot {
  userId: string | null;
  restaurantIds: string[];
  unavailable: boolean;
}
export const anonymousLikes: LikedPlacesSnapshot = { userId: null, restaurantIds: [], unavailable: false };
export type LikeResult = { snapshot?: LikedPlacesSnapshot; error?: string };
