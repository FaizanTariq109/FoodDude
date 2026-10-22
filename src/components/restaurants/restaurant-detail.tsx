"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Bookmark, MapPin, Quote, ArrowRight, Image as ImageIcon, Check } from "lucide-react";
import { FavoriteButton, PhotoFrame, RestaurantCard } from "./restaurant-card";
import { Modal } from "@/components/ui/modal";
import { OfferCard } from "@/components/offers/offer-card";
import { type Place } from "@/data/prototype/restaurants";
import { demoOffers } from "@/data/prototype/offers";
import { RestaurantBranches } from "./restaurant-branches";
import type { PublicBranch } from "@/lib/branches";
import { officialRestaurantUrl, priceLevelLabel } from "@/lib/restaurants/official";

export function RestaurantDetail({ place, source, branches = [], branchesUnavailable = false, saveControl }: { place: Place; source: Place[]; branches?: PublicBranch[]; branchesUnavailable?: boolean; saveControl?: ReactNode }) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const website = officialRestaurantUrl(place.website_url);
  const instagram = officialRestaurantUrl(place.instagram_url);
  const gallery = place.demo?.gallery ?? (place.demo ? [place.demo.photo] : []);
  const offers = demoOffers.filter(o => o.restaurantSlug === place.slug);
  const similar = source.filter(p => p.slug !== place.slug && p.category === place.category && p.demo).sort((a, b) => a.position - b.position).slice(0, 3);
  return <div className="container detail-page">
    <Link href="/places" className="back-link"><ArrowLeft size={15} />Back to places</Link>
    <div className="detail-heading"><div><p className="eyebrow">{place.category}</p><h1>{place.name}</h1><p className="detail-location"><MapPin size={16} />{place.demo?.area ?? "Lahore"}{place.demo && " · example area"}<span>·</span><Bookmark size={15} />Public catalogue</p></div><FavoriteButton slug={place.slug} name={place.name} large /></div>
    {saveControl}
    <section className="official-restaurant" aria-label="Official restaurant information">
      <p className="eyebrow">From the restaurant catalogue</p>
      <p className="official-description">{place.short_description?.trim() || "No official description has been added yet."}</p>
      {priceLevelLabel(place.price_level) && <p className="official-price">{priceLevelLabel(place.price_level)}</p>}
      <div className="official-links">
        {website && <a href={website} target="_blank" rel="noopener noreferrer">Official website<span className="sr-only"> for {place.name} (opens in a new tab)</span><ArrowUpRight size={16} aria-hidden="true" /></a>}
        {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer">Official Instagram<span className="sr-only"> for {place.name} (opens in a new tab)</span><ArrowUpRight size={16} aria-hidden="true" /></a>}
        {!website && !instagram && <p className="muted">No official links have been added yet.</p>}
      </div>
    </section>
    <div className={"detail-gallery " + (gallery.length < 2 ? "single" : "")}><PhotoFrame photo={gallery[0]} priority sizes="(max-width: 700px) 100vw, 70vw" />{gallery.length > 1 && <div className="gallery-side"><PhotoFrame photo={gallery[1]} /><PhotoFrame photo={gallery[2] ?? gallery[0]} /></div>}
      {gallery.length > 0 && <><span className="gallery-disclosure">Illustrative photography · not photos of {place.name}</span><Modal title="A little visual inspiration" className="button gallery-button" trigger={<><ImageIcon size={16} />View photos</>}><PhotoFrame photo={gallery[galleryIndex]} className="lightbox-photo" sizes="90vw" /><div className="gallery-controls">{gallery.map((photo, index) => <button key={photo.src} aria-label={"View illustrative photo " + (index + 1)} aria-pressed={index === galleryIndex} onClick={() => setGalleryIndex(index)}>{index + 1}</button>)}</div><p className="muted">Illustrative images, not verified photographs of this restaurant.</p></Modal></>}
    </div>
    <p className="prototype-note"><span className="tiny-dot" />Demo imagery, areas, notes and offers are illustrative and unverified. Official restaurant and branch information comes from the catalogue.</p>
    <div className="detail-columns"><div className="detail-main">
      <section className="detail-section"><div className="section-heading"><h2>What I liked.</h2>{place.demo && <span className="demo-label">Example notes</span>}</div>{place.demo ? <><div className="note-card"><Quote size={23} strokeWidth={1.4} /><p>{place.demo.note}</p><span>A LITTLE NOTE TO SELF · DEMO</span></div><div className="recommendations">{place.demo.liked.map(item => <span key={item}><Check size={15} />{item}</span>)}</div></> : <p className="quiet-empty">No recommendations yet. A fresh page for a future visit.</p>}</section>
      <section className="detail-section" id="offers"><div className="section-heading"><div><p className="eyebrow">A LITTLE EXTRA REASON</p><h2>Offers at the table.</h2></div><span className="demo-label">Demo offers</span></div><p className="muted detail-offer-note">Illustrative only. Check actual availability with the restaurant and bank.</p>{offers.length ? <div className="detail-offers">{offers.map(offer => <OfferCard key={offer.id} offer={offer} compact />)}</div> : <p className="quiet-empty">No demo offers for this place. Good food is still a good plan.</p>}</section>
    </div><aside className="detail-sidebar"><RestaurantBranches branches={branches} unavailable={branchesUnavailable} /><div className="sidebar-note"><Bookmark size={20} /><p>One of {source.length} places<br />in the public catalogue.</p><Link href="/places">Explore all places<ArrowRight size={14} /></Link></div></aside></div>
    {similar.length > 0 && <section className="home-section"><div className="section-heading"><div><p className="eyebrow">KEEP THE OPTIONS OPEN</p><h2>More places to explore.</h2></div><Link className="text-link" href="/places">View all<ArrowUpRight size={16} /></Link></div><div className="restaurant-grid similar-grid">{similar.map(p => <RestaurantCard key={p.slug} place={p} />)}</div></section>}
  </div>;
}
