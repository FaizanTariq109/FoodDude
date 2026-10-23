import "server-only";
import sharp from "sharp";
import { PHOTO_BYTES, checkPhotoType, photoType } from "./place-photo";

export async function processPlacePhoto(file: File): Promise<Buffer> {
  checkPhotoType(file.type);
  if (!file.size) throw Error("Photo is empty. Choose another image.");
  if (file.size > PHOTO_BYTES) throw Error("Photo is too large. Choose a smaller image and try again.");
  const input = Buffer.from(await file.arrayBuffer());
  if (photoType(input) !== file.type) throw Error("Photo content does not match its file type.");
  try {
    const options = { failOn: "warning" as const, limitInputPixels: 40_000_000 };
    const meta = await sharp(input, options).metadata();
    if (!meta.width || !meta.height || (meta.pages ?? 1) !== 1 || !["jpeg","png","webp"].includes(meta.format ?? "")) throw Error();
    for (const quality of [82, 64, 48]) {
      // rotate applies EXIF orientation; output drops metadata by default.
      const output = await sharp(input, options).rotate().resize({ width:1600, height:1600, fit:"inside", withoutEnlargement:true }).webp({ quality, effort:4 }).toBuffer();
      if (output.length <= PHOTO_BYTES) return output;
    }
  } catch { throw Error("Photo could not be decoded safely. Choose a valid, non-animated JPEG, PNG or WebP image."); }
  throw Error("Photo could not be compressed below 1MB. Choose a simpler image.");
}
