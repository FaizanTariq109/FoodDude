"use client";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, CreditCard, MapPin, ChevronDown } from "lucide-react";
import { PhotoFrame } from "@/components/restaurants/restaurant-card";
import { places } from "@/data/prototype/restaurants";
import { prototypeBanks, prototypeCards } from "@/data/prototype/banks";
import { daysLabel, money, type DemoOffer } from "@/data/prototype/offers";

export function OfferCard({ offer, compact = false }: { offer: DemoOffer; compact?: boolean }) {
  const place = places.find(p => p.slug === offer.restaurantSlug)!;
  const bank = prototypeBanks.find(b => b.id === offer.bankId);
  const branches = offer.branchIds ? place.demo?.branches.filter(b => offer.branchIds?.includes(b.id)).map(b => b.area).join(", ") : "All example branches";
  return <article className={"offer-card " + (compact ? "compact" : "")}>
    {!compact && <Link href={"/places/" + place.slug} className="offer-image"><PhotoFrame photo={place.demo?.photo} sizes="(max-width: 640px) 100vw, 300px" /><span className="image-caption">Illustrative photo</span></Link>}
    <div className="offer-card-content"><div className="offer-topline"><span className="eyebrow">{bank ? <CreditCard size={13} /> : <span className="tiny-dot" />}{bank ? "Bank offer" : "Restaurant offer"}</span><span className="demo-label">Demo offer</span></div>
      {!compact && <Link href={"/places/" + place.slug} className="offer-place">{place.name}<ArrowUpRight size={18} /></Link>}
      <h3 className="discount">{offer.label}</h3>
      <p className="bank-line">{bank ? <><span className="bank-mark" style={{ background: bank.color }}>{bank.shortName[0]}</span><strong>{bank.name}</strong> · {prototypeCards.filter(c => offer.cardIds.includes(c.id)).map(c => c.name).join(", ")}</> : "A little something from the restaurant."}</p>
      <div className="offer-facts"><span><CalendarDays size={14} />{daysLabel(offer.days)}</span><span><MapPin size={14} />{branches}</span><span>Until {offer.expiryDate}</span></div>
      <div className="offer-numbers"><span>Max discount <strong>{offer.cap !== null ? money(offer.cap) : "Not specified"}</strong></span><span>Min. spend <strong>{offer.minimumSpend !== null ? money(offer.minimumSpend) : "Not specified"}</strong></span></div>
      <details className="offer-terms"><summary>Terms & details <ChevronDown size={15} /></summary><div><p>{offer.terms}</p><p>Example validity: {offer.startDate} to {offer.expiryDate} (inclusive). {branches}. No verification date has been recorded.</p></div></details>
    </div>
  </article>;
}
