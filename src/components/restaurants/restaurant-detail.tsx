"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Bookmark, MapPin, Quote, ArrowRight, Image as ImageIcon, Check } from "lucide-react";
import { FavoriteButton, PhotoFrame, RestaurantCard } from "./restaurant-card";
import { Modal } from "@/components/ui/modal";
import { OfferCard } from "@/components/offers/offer-card";
import { places, type Place } from "@/data/prototype/restaurants";
import { demoOffers } from "@/data/prototype/offers";

export function RestaurantDetail({ place }: { place: Place }) {
  const [branch, setBranch] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const gallery = place.demo?.gallery ?? (place.demo ? [place.demo.photo] : []);
  const offers = demoOffers.filter(o => o.restaurantSlug === place.slug && (!branch || o.branchIds === null || o.branchIds.includes(branch)));
  const similar = places.filter(p => p.slug !== place.slug && p.category === place.category && p.demo).slice(0, 3);
  return <div className="container detail-page">
    <Link href="/places" className="back-link"><ArrowLeft size={15} />Back to your places</Link>
    <div className="detail-heading"><div><p className="eyebrow">{place.category}{place.demo && " · " + place.demo.tags.join(" · ")}</p><h1>{place.name}</h1><p className="detail-location"><MapPin size={16} />{place.demo?.area ?? "Lahore"}{place.demo && " · example area"}<span>·</span><Bookmark size={15} />On your list</p></div><FavoriteButton slug={place.slug} name={place.name} large /></div>
    <div className={"detail-gallery " + (gallery.length < 2 ? "single" : "")}><PhotoFrame photo={gallery[0]} priority sizes="(max-width: 700px) 100vw, 70vw" />{gallery.length > 1 && <div className="gallery-side"><PhotoFrame photo={gallery[1]} /><PhotoFrame photo={gallery[2] ?? gallery[0]} /></div>}
      {gallery.length > 0 && <><span className="gallery-disclosure">Illustrative photography · not photos of {place.name}</span><Modal title="A little visual inspiration" className="button gallery-button" trigger={<><ImageIcon size={16} />View photos</>}><PhotoFrame photo={gallery[galleryIndex]} className="lightbox-photo" sizes="90vw" /><div className="gallery-controls">{gallery.map((photo, index) => <button key={photo.src} aria-label={"View illustrative photo " + (index + 1)} aria-pressed={index === galleryIndex} onClick={() => setGalleryIndex(index)}>{index + 1}</button>)}</div><p className="muted">Illustrative images, not verified photographs of this restaurant.</p></Modal></>}
    </div>
    <p className="prototype-note"><span className="tiny-dot" />Prototype details below are illustrative. Restaurant name and category come from your original list.</p>
    <div className="detail-columns"><div className="detail-main">
      <section className="detail-about"><p className="eyebrow">THE SHORT VERSION</p><h2>A place to keep in mind.</h2><p>{place.demo?.description ?? "Already on your Lahore list. Photos, branch information and personal recommendations will be added once verified."}</p></section>
      <section className="detail-section"><div className="section-heading"><h2>What I liked.</h2>{place.demo && <span className="demo-label">Example notes</span>}</div>{place.demo ? <><div className="note-card"><Quote size={23} strokeWidth={1.4} /><p>{place.demo.note}</p><span>A LITTLE NOTE TO SELF · DEMO</span></div><div className="recommendations">{place.demo.liked.map(item => <span key={item}><Check size={15} />{item}</span>)}</div></> : <p className="quiet-empty">No recommendations yet. A fresh page for a future visit.</p>}</section>
      <section className="detail-section" id="offers"><div className="section-heading"><div><p className="eyebrow">A LITTLE EXTRA REASON</p><h2>Offers at the table.</h2></div><span className="demo-label">Demo offers</span></div><p className="muted detail-offer-note">Illustrative only. Check actual availability with the restaurant and bank.</p>{offers.length ? <div className="detail-offers">{offers.map(offer => <OfferCard key={offer.id} offer={offer} compact />)}</div> : <p className="quiet-empty">No demo offers for this {branch ? "branch" : "place"}. Good food is still a good plan.</p>}</section>
    </div><aside className="detail-sidebar"><div className="branch-panel"><p className="eyebrow">PICK YOUR CORNER OF LAHORE</p><h2>Where to go.</h2>{place.demo ? <><p className="muted">Example branches, not verified locations.</p><label className="branch-select">Show offers for<select value={branch} onChange={e => setBranch(e.target.value)}><option value="">All example branches</option>{place.demo.branches.map(b => <option key={b.id} value={b.id}>{b.area}</option>)}</select></label>{place.demo.branches.filter(b => !branch || b.id === branch).map(b => <div className="branch-card" key={b.id}><div><MapPin size={19} /><h3>{b.area}</h3></div><p>{b.label}<br />Address & phone not verified.</p><a href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(b.area + ", Lahore, Pakistan")} target="_blank" rel="noreferrer">Explore this area <ArrowUpRight size={15} /></a><small>Area search, not restaurant directions.</small></div>)}</> : <p className="muted">No verified branches yet. We’ll add addresses and directions later.</p>}</div><div className="sidebar-note"><Bookmark size={20} /><p>One of 74 places<br />on your Lahore list.</p><Link href="/places">The whole collection<ArrowRight size={14} /></Link></div></aside></div>
    {similar.length > 0 && <section className="home-section"><div className="section-heading"><div><p className="eyebrow">KEEP THE OPTIONS OPEN</p><h2>More from your list.</h2></div><Link className="text-link" href="/places">View all<ArrowUpRight size={16} /></Link></div><div className="restaurant-grid similar-grid">{similar.map(p => <RestaurantCard key={p.slug} place={p} />)}</div></section>}
  </div>;
}
