import { ArrowUpRight, MapPin } from "lucide-react";
import { mapsUrl, phoneHref, type PublicBranch } from "@/lib/branches";

export function RestaurantBranches({ branches, unavailable = false }: { branches: PublicBranch[]; unavailable?: boolean }) {
  return <section className="branch-panel" aria-label="Restaurant branches"><p className="eyebrow">FROM THE RESTAURANT CATALOGUE</p><h2>Where to go.</h2>
    {unavailable ? <p className="muted">Branch information is temporarily unavailable. Please try again later.</p> : !branches.length ? <p className="muted">No verified branch information has been entered yet.</p> : branches.map(branch => {
      const maps = mapsUrl(branch.google_maps_url), phone = phoneHref(branch.phone);
      const title = branch.name || branch.area || "Branch";
      return <div className="branch-card" key={branch.id}><div><MapPin size={19} aria-hidden="true" /><h3>{title}</h3></div>
        {branch.area && branch.area !== title && <p>{branch.area}</p>}
        <p>{branch.address || "Address not recorded yet."}</p>
        {branch.phone && (phone ? <a href={phone}>Call {branch.phone}<span className="sr-only"> — {title}</span></a> : <p>Phone: {branch.phone}</p>)}
        {maps && <a href={maps} target="_blank" rel="noopener noreferrer">Directions<span className="sr-only"> to {title} (opens in a new tab)</span><ArrowUpRight size={15} aria-hidden="true" /></a>}
      </div>;
    })}
  </section>;
}
