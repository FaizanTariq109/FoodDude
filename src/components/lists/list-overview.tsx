import Link from "next/link";
import { ArrowUpRight, Bookmark, Heart, LockKeyhole } from "lucide-react";
import { NewListTile } from "./list-forms";
import type { ListSummary } from "@/lib/lists";

export function ListOverview({ lists }: { lists: ListSummary[] }) {
  return <div className="container lists-page"><header className="lists-heading"><p className="eyebrow"><LockKeyhole size={12} />PRIVATE LISTS</p><h1>My Lists<span>.</span></h1><p>Only you can see your lists and notes.</p></header>
    <section className="collection-grid" aria-label="Your lists"><NewListTile />{lists.map(list => <Link className="collection-card" href={`/lists/${list.id}`} key={list.id}>
      <div className="collection-card-top">{list.kind === "liked" ? <Heart size={20} strokeWidth={1.4} fill="currentColor" /> : <Bookmark size={20} strokeWidth={1.4} />}<ArrowUpRight size={17} /></div><h2>{list.name}</h2>{list.description && <p className="collection-description">{list.description}</p>}<span className="collection-card-bottom">{list.restaurantCount} {list.restaurantCount === 1 ? "restaurant" : "restaurants"}<span>{list.kind === "liked" ? "Default favorites" : "Only you"}</span></span>
    </Link>)}</section>{lists.length === 0 && <p className="lists-empty-hint">Create your first list, or <Link href="/discover">browse restaurants ↗</Link></p>}
  </div>;
}
