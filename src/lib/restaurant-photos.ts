export const RESTAURANT_PHOTO_BUCKET = "restaurant-photos";
export const MAX_RESTAURANT_PHOTOS = 12;
export interface OfficialPhoto {
  id: string; storage_path: string; alt_text: string; sort_order: number; is_cover: boolean;
  photo_object_id?: string; thumbnail_object_id?: string;
}
export interface RestaurantGallery { version: string; images: OfficialPhoto[] }
export interface CataloguePhoto { src: string; cardSrc: string; alt: string; official: true }
export function officialPhotoPath(restaurantId: string, path: string) {
  return typeof path==="string" && path.startsWith(restaurantId+"/") && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/(full|card)\.webp$/.test(path);
}
export function cataloguePhoto(base: string, restaurantId: string, row: OfficialPhoto): CataloguePhoto | null {
  if(!officialPhotoPath(restaurantId,row.storage_path)||!row.storage_path.endsWith('/full.webp'))return null;
  const src=base.replace(/\/$/,"")+"/storage/v1/object/public/"+RESTAURANT_PHOTO_BUCKET+"/"+row.storage_path;
  return {src,cardSrc:src.replace('/full.webp','/card.webp'),alt:row.alt_text,official:true};
}
