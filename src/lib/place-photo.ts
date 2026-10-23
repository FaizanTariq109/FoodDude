export const PHOTO_BUCKET = "user-place-photos";
export const PHOTO_BYTES = 1_048_576;
export const PHOTO_SOURCE_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export function coverSource(id: string, objectId?: string | null) {
  return objectId ? `/lists/places/${id}/photo?v=${encodeURIComponent(objectId)}` : null;
}
export function photoType(bytes: Uint8Array): string | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return "image/png";
  if (String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return "image/webp";
  return null;
}
export function checkPhotoType(type: string) {
  if (/hei[cf]/i.test(type)) throw Error("HEIC/HEIF is not supported yet. Export or select a JPEG, PNG or WebP image.");
  if (!PHOTO_TYPES.includes(type)) throw Error("Choose a JPEG, PNG or WebP photo. SVG and other files are not supported.");
}
