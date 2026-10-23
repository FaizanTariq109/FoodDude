import { PHOTO_SOURCE_BYTES, checkPhotoType, photoType } from "./place-photo";

// Browser preprocessing reduces network/body size; the server independently
// decodes and re-encodes the submitted bytes before they reach Storage.
export async function preparePlacePhoto(file: File): Promise<File> {
  checkPhotoType(file.type);
  if(!file.size)throw Error("Photo is empty. Choose another image.");
  if (file.size > PHOTO_SOURCE_BYTES) throw Error("Choose a source photo under 10MB.");
  if (photoType(new Uint8Array(await file.slice(0,16).arrayBuffer())) !== file.type) throw Error("Photo content does not match its file type.");
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 40_000_000) throw Error("Choose a photo under 40 megapixels.");
    const scale = Math.min(1, 1600 / Math.max(image.width,image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1,Math.round(image.width*scale)); canvas.height = Math.max(1,Math.round(image.height*scale));
    const context = canvas.getContext("2d");
    if (!context) throw Error("Photo processing is unavailable in this browser.");
    context.drawImage(image,0,0,canvas.width,canvas.height);
    for (const quality of [0.82,0.64,0.48]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,"image/webp",quality));
      if (blob?.type === "image/webp" && blob.size <= 960_000) return new File([blob],"cover.webp",{type:"image/webp"});
    }
    throw Error("Photo could not be compressed. Choose a smaller image.");
  } finally { image.close(); }
}
