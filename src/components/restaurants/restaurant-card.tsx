"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, MapPin, Utensils, Coffee, Bookmark } from "lucide-react";
import { FavoriteButton } from "@/components/lists/favorite-button";
export { FavoriteButton } from "@/components/lists/favorite-button";
import { type Place, type Photo } from "@/data/prototype/restaurants";
import { demoOffers, daysLabel, type DemoOffer } from "@/data/prototype/offers";
import { prototypeBanks } from "@/data/prototype/banks";
import { priceLevelLabel } from "@/lib/restaurants/official";

export function PhotoFrame({ photo, className = "", priority = false, sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw" }: { photo?: Photo; className?: string; priority?: boolean; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={"photo-frame " + className}>{photo && !failed ? <Image src={photo.src} alt={photo.alt} fill sizes={sizes} preload={priority} onError={() => setFailed(true)} /> : <div className="photo-placeholder"><Utensils size={32} strokeWidth={1} /><span>A place on your list</span><small>Photography to come</small></div>}</div>;
}
export function RestaurantCard({ place, personal = false, offer: suppliedOffer }: { place: Place; personal?: boolean; offer?: DemoOffer | null }) {
  const offer = suppliedOffer === undefined ? demoOffers.find(o => o.restaurantSlug === place.slug) : suppliedOffer;
  const bank = prototypeBanks.find(b => b.id === offer?.bankId);
  return <article className="restaurant-card">
    <div className="card-visual"><Link href={"/places/" + place.slug} aria-label={"Explore " + place.name}><PhotoFrame photo={place.demo?.photo} /></Link>
      <FavoriteButton restaurantId={place.id} name={place.name} />
      {place.demo ? <span className="image-caption">Illustrative photo</span> : <span className="collection-badge"><Bookmark size={12} /> Public catalogue</span>}
      {offer && !personal && <span className="image-offer"><span className="tiny-dot" />{offer.label}<small>DEMO</small></span>}
    </div>
    <div className="card-content"><p className="eyebrow card-category">{place.category === "cafe" ? <Coffee size={12} /> : <Utensils size={12} />}{place.category}</p>
      <Link href={"/places/" + place.slug} className="card-title"><h3>{place.name}</h3><ArrowUpRight size={18} /></Link>
      <p className="card-description">{place.short_description?.trim() || "No official description added yet."}</p>
      {priceLevelLabel(place.price_level) && <p className="card-price">{priceLevelLabel(place.price_level)}</p>}
      <p className="card-location"><MapPin size={13} />{place.demo ? place.demo.area + " · example area" : "Lahore · details to come"}</p>
      {personal ? <p className="personal-note">{place.demo ? <><span>DEMO NOTE</span>“{place.demo.note}”</> : "No example note."}</p> : offer ? <div className="card-offer-summary"><span>{bank?.shortName || "Restaurant offer"}</span><span>{daysLabel(offer.days)}</span></div> : <div className="card-offer-summary muted"><span>Public catalogue</span><span>No offers added</span></div>}
    </div>
  </article>;
}
