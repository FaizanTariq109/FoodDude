"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, MapPin, Search, Coffee, Utensils, CreditCard, Moon, Check, Sparkles } from "lucide-react";
import { PhotoFrame, RestaurantCard } from "@/components/restaurants/restaurant-card";
import { photos, enrichRestaurants, areas } from "@/data/prototype/restaurants";
import type { PublicRestaurant } from "@/lib/data/restaurants";
import { demoOffers, isOfferValid } from "@/data/prototype/offers";
import { prototypeCards, prototypeBanks } from "@/data/prototype/banks";
import { defaultFilters, filtersQuery, type Filters } from "@/lib/discovery";
import { useLahoreDate } from "@/components/layout/preview-provider";

function SectionHeading({ title, href, label = "Explore all" }: { title: string; href: string; label?: string }) {
  return <div className="section-heading"><div><h2>{title}</h2></div><Link className="text-link" href={href}>{label}<ArrowUpRight size={17} /></Link></div>;
}
export function HomeExperience({ restaurants }: { restaurants: PublicRestaurant[] }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const [cards, setCards] = useState<string[]>([]);
  const date = useLahoreDate();
  const change = (patch: Partial<Filters>) => setFilters(previous => ({ ...previous, ...patch }));
  const submit = (event: FormEvent) => { event.preventDefault(); router.push("/discover?" + filtersQuery(filters)); };
  const places = enrichRestaurants(restaurants);
  const bySlug = new Map(places.map(place => [place.slug, place]));
  const todays = demoOffers.filter(o => bySlug.has(o.restaurantSlug) && date && isOfferValid(o, date));
  const deals = [...new Map(todays.map(o => [o.restaurantSlug, o])).values()].slice(0, 4);
  const returning = ["amu", "basil-bistro", "jhonny-jhugnu", "pret-brasserie"].flatMap(slug => {
    const place = bySlug.get(slug);
    return place ? [place] : [];
  });
  const cafes = ["brewscape", "double-shot"].flatMap(slug => {
    const place = bySlug.get(slug);
    return place?.category === "cafe" ? [place] : [];
  });
  return <>
    <section className="home-hero"><div className="hero-inner">
      <div className="hero-composition"><div className="hero-copy"><p className="eyebrow"><span className="tiny-dot" /> THE LAHORE EDIT / AFTER HOURS</p><h1>Where are <br />we <em>eating?</em></h1><p>Discover Lahore restaurants and cafes.<br className="desktop-break" /> Save your favourites in private lists.</p></div><div className="hero-image"><PhotoFrame photo={photos.dining} priority sizes="(max-width: 700px) 100vw, 60vw" /><div className="hero-image-shade" /><div className="hero-photo-caption"><span><MapPin size={14} /> Lahore dining · illustrative image</span><small>Illustrative photography</small></div><div className="hero-stamp"><Utensils size={20} /><span>THE<br />LAHORE<br />LIST</span></div></div></div>
      <form className="hero-search" onSubmit={submit}><div className="hero-search-main"><label className="hero-query"><span>RESTAURANT OR CAFE</span><div><Search size={19} /><input type="search" placeholder="Search restaurants…" value={filters.q} onChange={e => change({ q: e.target.value })} /></div></label><label className="hero-area"><span>NEIGHBOURHOOD</span><div><MapPin size={18} /><select value={filters.area} onChange={e => change({ area: e.target.value })}><option value="">Anywhere in Lahore</option>{areas.map(area => <option key={area}>{area}</option>)}</select></div></label><button type="submit" className="button button-dark">Find a place<ArrowRight size={18} /></button></div>
        <div className="hero-search-extras"><label><span className="sr-only">Restaurant or cafe</span><select value={filters.category} onChange={e => change({ category: e.target.value })}><option value="">Restaurants & cafes</option><option value="restaurant">Restaurants</option><option value="cafe">Cafes</option></select></label><label><CreditCard size={15} /><span className="sr-only">Bank and card</span><select value={filters.card} onChange={e => change({ card: e.target.value })}><option value="">Your bank card</option>{prototypeCards.map(card => <option key={card.id} value={card.id}>{prototypeBanks.find(b => b.id === card.bankId)?.shortName} · {card.name}</option>)}</select></label><label><span className="sr-only">Minimum discount</span><select value={filters.min} onChange={e => change({ min: e.target.value })}><option value="">Any discount</option><option value="20">20% or more</option><option value="25">25% or more</option><option value="30">30% or more</option></select></label><label className="today-toggle"><input type="checkbox" checked={filters.today} onChange={e => change({ today: e.target.checked })} /><span>Valid today</span></label><span className="search-demo">Demo offer data</span></div>
      </form>
      <div className="quick-intents"><span>IN THE MOOD FOR</span><Link href="/discover?tag=Coffee"><Coffee size={15} />Coffee</Link><Link href="/discover?tag=Date+night"><Moon size={15} />Date night</Link><Link href="/discover?tag=Burgers">Burgers</Link><Link href="/discover?min=25&sort=discount">Demo offers<ArrowUpRight size={13} /></Link><Link href="/discover?liked=true">Liked Places</Link></div>
    </div></section>
    <section className="container home-section"><SectionHeading title="Today’s demo offers" href="/offers?today=true" label="Today's demo offers" /><div className="section-description"><p>Sample offers matching today in Lahore time.</p><span className="demo-label">Illustrative, unverified offers</span></div><div className="restaurant-grid home-grid">{deals.length ? deals.flatMap(offer => { const place = bySlug.get(offer.restaurantSlug); return place ? [<RestaurantCard key={offer.id} place={place} offer={offer} />] : []; }) : <div className="quiet-empty">{date ? "No demo offers match today. Explore the full list instead." : "Finding today's demo offers…"} <Link href="/offers">Browse offers →</Link></div>}</div></section>
    <section className="container"><div className="tonight-banner"><div className="tonight-copy"><h2>Match your cards<br />to demo offers.</h2><p>Pick the cards at your table.<br />We’ll find the demo offers that match tonight.</p></div><div className="wallet"><span className="eyebrow">CARDS AT YOUR TABLE</span><div className="wallet-cards">{prototypeCards.map(card => <button key={card.id} className={"wallet-card " + (cards.includes(card.id) ? "selected" : "")} onClick={() => setCards(previous => previous.includes(card.id) ? previous.filter(c => c !== card.id) : [...previous, card.id])} aria-pressed={cards.includes(card.id)}><span className="wallet-bank"><CreditCard size={18} />{prototypeBanks.find(b => b.id === card.bankId)?.name}<span className="wallet-check">{cards.includes(card.id) && <Check size={13} />}</span></span><strong>{card.name}</strong><small>ILLUSTRATIVE CARD MATCHING</small></button>)}</div><Link className="button button-light" href={"/discover?today=true&sort=discount" + (cards.length ? "&card=" + encodeURIComponent(cards.join(",")) : "")}>Find matching offers <ArrowUpRight size={17} /></Link></div></div></section>
    <section className="container home-section journal-section"><SectionHeading title="From the catalogue" href="/places" label={`All ${places.length} places`} /><div className="restaurant-grid home-grid">{returning.map(place => <RestaurantCard key={place.slug} place={place} personal />)}</div></section>
    <section className="coffee-section"><div className="container coffee-layout"><div className="coffee-copy"><h2>Cafes in Lahore</h2><p>Browse cafes and coffee spots.</p><Link className="text-link" href="/discover?category=cafe">Find your next coffee spot<ArrowUpRight size={17} /></Link><span className="coffee-doodle"><Sparkles size={32} strokeWidth={1} /></span></div><div className="coffee-cards">{cafes.map(place => <RestaurantCard key={place.slug} place={place} />)}</div></div></section>
    <section className="container mood-section"><div><h2>Browse by category</h2></div><div className="mood-links">{["Desi", "Italian", "Rooftop", "Dessert", "Casual"].map((tag, i) => <Link href={"/discover?tag=" + encodeURIComponent(tag)} key={tag}><span>0{i + 1}</span>{tag}<ArrowUpRight size={18} /></Link>)}</div></section>
  </>;
}
