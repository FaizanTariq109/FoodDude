"use client";
import { useState, useId } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, ArrowUpRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { defaultFilters, parseFilters, filterPlaces, offerMatches, placeMatches, type Filters } from "@/lib/discovery";
import { areas, tags, places, type Place } from "@/data/prototype/restaurants";
import { demoOffers, dayNames } from "@/data/prototype/offers";
import { prototypeBanks, prototypeCards } from "@/data/prototype/banks";
import { RestaurantCard } from "@/components/restaurants/restaurant-card";
import { OfferCard } from "@/components/offers/offer-card";
import { Modal } from "@/components/ui/modal";
import { useLahoreDate } from "@/components/layout/preview-provider";

import { useLikedPlaces } from "@/components/lists/liked-places-provider";

type Mode = "discover" | "places" | "offers";
export function FilterControls({ filters: f, change, mode }: { filters: Filters; change: (patch: Partial<Filters>) => void; mode: Mode }) {
  return <div className="filter-controls">
    <label>Area<select value={f.area} onChange={e => change({ area: e.target.value })}><option value="">All of Lahore</option>{areas.map(area => <option key={area}>{area}</option>)}</select></label>
    {mode !== "offers" && <label>Mood / category<select value={f.tag} onChange={e => change({ tag: e.target.value })}><option value="">Any mood</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select></label>}
    {mode !== "places" && <>
      <label>Bank<select value={f.bank} onChange={e => change({ bank: e.target.value, card: "" })}><option value="">All banks</option>{prototypeBanks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></label>
      <label>Card<select value={f.card} onChange={e => { const card = prototypeCards.find(c => c.id === e.target.value); change({ card: e.target.value, bank: card?.bankId ?? f.bank }); }}><option value="">Any card</option>{f.card.includes(",") && <option value={f.card}>Group cards ({f.card.split(",").length})</option>}{prototypeCards.filter(c => !f.bank || c.bankId === f.bank).map(card => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>
      <label>Minimum discount<select value={f.min} onChange={e => change({ min: e.target.value })}><option value="">Any offer</option>{[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}% or more</option>)}</select></label>
      {mode === "offers" && <><label>Offer type<select value={f.type} onChange={e => change({ type: e.target.value })}><option value="">All offers</option><option value="bank">Bank offers</option><option value="restaurant">Restaurant offers</option></select></label><label>Day of week<select value={f.day} onChange={e => change({ day: e.target.value, today: false })}><option value="">Any day</option>{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label></>}
      <label className="checkbox-control"><input type="checkbox" checked={f.today} onChange={e => change({ today: e.target.checked, day: "" })} /><span>Valid today<small>Lahore time · demo offers</small></span></label>
    </>}
    {mode !== "offers" && <label className="checkbox-control"><input type="checkbox" checked={f.liked} onChange={e => change({ liked: e.target.checked })} /><span>Liked places<small>Saved in Liked Places</small></span></label>}
  </div>;
}
const copy = {
  discover: { title: "Discover", description: "Find restaurants and cafes in Lahore." },
  places: { title: "Restaurants", description: "Browse the public restaurant catalogue." },
  offers: { title: "Offers", description: "Explore illustrative bank and restaurant offers." },
};
export function Explorer({ mode, source = places }: { mode: Mode; source?: Place[] }) {
  const params = useSearchParams();
  return <ExplorerContent key={params.toString()} mode={mode} source={source} initial={{ ...parseFilters(params), sort: params.get("sort") || (mode === "places" ? "az" : "recommended") }} />;
}
function ExplorerContent({ mode, initial, source }: { mode: Mode; initial: Filters; source: Place[] }) {
  const [filters, setFilters] = useState(initial);
  const date = useLahoreDate();
  const { restaurantIds, userId, unavailable } = useLikedPlaces();
  const favorites = source.filter(place => restaurantIds.includes(place.id)).map(place => place.slug);
  const id = useId();
  const change = (patch: Partial<Filters>) => setFilters(previous => ({ ...previous, ...patch }));
  const reset = () => setFilters({ ...defaultFilters, sort: mode === "places" ? "az" : "recommended" });
  const results = filterPlaces(filters, date, favorites, source);
  const offers = demoOffers.filter(offer => offerMatches(offer, filters, date) && placeMatches(places.find(p => p.slug === offer.restaurantSlug)!, filters, favorites)).sort((a, b) => filters.sort === "discount" ? (b.discountType === "percentage" ? b.value ?? 0 : 0) - (a.discountType === "percentage" ? a.value ?? 0 : 0) : filters.sort === "az" ? places.find(p => p.slug === a.restaurantSlug)!.name.localeCompare(places.find(p => p.slug === b.restaurantSlug)!.name) : 0);
  const count = mode === "offers" ? offers.length : results.length;
  const active = Object.entries(filters).filter(([key, value]) => key !== "sort" && value);
  const valueLabel = (key: string, value: string | boolean) => {
    if (key === "today") return "Valid today";
    if (key === "liked") return "Liked";
    if (key === "min") return value + "%+";
    if (key === "bank") return prototypeBanks.find(b => b.id === value)?.name ?? value;
    if (key === "card") return String(value).split(",").map(id => prototypeCards.find(c => c.id === id)?.name ?? id).join(" + ");
    if (key === "day") return dayNames[Number(value)];
    return String(value);
  };
  return <div className={"container browse-page browse-" + mode}>
    <header className="page-intro"><div><h1>{copy[mode].title}</h1><p className="intro-copy">{mode === "places" ? `${source.length} restaurants and cafes in the public catalogue.` : copy[mode].description}</p></div></header>
    {mode === "discover" && <Link className="text-link catalogue-link" href="/places">Browse the full catalogue<ArrowUpRight size={14} /></Link>}
    {filters.liked && (!userId || unavailable) && <p className="list-message" role="status">{unavailable ? "Liked Places couldn’t be loaded. Reload to try again." : <><Link href="/login">Sign in</Link> to see Liked Places.</>}</p>}
    <p className="prototype-note"><span className="tiny-dot" />{mode === "offers" ? "Demo offer data — illustrative, unverified, and not redeemable." : "Prototype preview · photos, areas, tags and notes are illustrative."}</p>
    <section className="browse-toolbar" aria-label="Browse controls">
      <div className="toolbar-main"><label className="search-field"><Search size={19} /><span className="sr-only">Search restaurants</span><input type="search" placeholder={mode === "offers" ? "Search by restaurant…" : "Search restaurants…"} value={filters.q} onChange={e => change({ q: e.target.value })} /></label>
        {mode !== "offers" && <div className="segmented" role="group" aria-label="Place type">{[["", "All places"], ["restaurant", "Restaurants"], ["cafe", "Cafes"]].map(([value, label]) => <button key={value} className={filters.category === value ? "active" : ""} aria-pressed={filters.category === value} onClick={() => change({ category: value })}>{label}</button>)}</div>}
        <Modal title="Filters" sheet className="button button-outline mobile-filter-trigger" trigger={<><SlidersHorizontal size={17} />Filters{active.length > 0 && <span className="count-badge">{active.length}</span>}</>}><FilterControls filters={filters} change={change} mode={mode} /><button className="text-button" onClick={reset}>Clear all filters</button><p className="muted" aria-live="polite">{count} {mode === "offers" ? "offers" : "places"} match</p></Modal>
      </div>
      <div className="desktop-filters"><FilterControls filters={filters} change={change} mode={mode} /></div>
    </section>
    {active.length > 0 && <div className="active-filters" aria-label="Selected filters">{active.map(([key, value]) => <button key={key} onClick={() => change(key === "bank" ? { bank: "", card: "" } : { [key]: key === "today" || key === "liked" ? false : "" })}>{valueLabel(key, value)}<X size={13} /><span className="sr-only">Remove filter</span></button>)}<button className="clear-filter" onClick={reset}>Clear all</button></div>}
    <div className="results-heading"><p aria-live="polite"><strong>{count}</strong> {mode === "offers" ? "offers" : "restaurants and cafes"}{filters.today && <span> · today</span>}</p><label htmlFor={id}>Sort by <select id={id} value={filters.sort} onChange={e => change({ sort: e.target.value })}><option value="recommended">Curated order</option><option value="az">A–Z</option>{mode !== "offers" && <option value="recent">Last on the list</option>}{mode !== "places" && <option value="discount">Highest percentage</option>}</select></label></div>
    {count ? mode === "offers" ? <div className="offers-grid">{offers.map(offer => <OfferCard key={offer.id} offer={offer} />)}</div> : <div className="restaurant-grid">{results.map(place => <RestaurantCard key={place.slug} place={place} personal={mode === "places"} offer={demoOffers.find(o => o.restaurantSlug === place.slug && offerMatches(o, filters, date)) ?? null} />)}</div> : <div className="empty-state"><Search size={35} strokeWidth={1.2} /><h2>No results</h2><p>Try changing or clearing your filters.</p><button className="button button-dark" onClick={reset}><RotateCcw size={16} />Reset filters</button></div>}
    {mode === "places" && <div className="list-footnote"><span>Hearts save restaurants to your private Liked Places collection.</span><Link href="/discover">Find something different <ArrowUpRight size={16} /></Link></div>}
  </div>;
}
