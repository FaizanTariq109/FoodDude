import "server-only";
import sharp from "sharp";
import { processPlacePhoto } from "./process-place-photo";
export async function processRestaurantPhoto(file: File) {
  const full=await processPlacePhoto(file);
  for(const quality of [76,60,44]){
    const card=await sharp(full).resize({width:640,height:640,fit:"inside",withoutEnlargement:true}).webp({quality,effort:4}).toBuffer();
    if(card.length<=163840)return {full,card};
  }
  throw Error("Photo thumbnail could not be compressed. Choose a simpler image.");
}
