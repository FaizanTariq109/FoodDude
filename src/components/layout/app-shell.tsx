"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUpRight, Compass, Bookmark, Tag, MapPin, Moon, Mail } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { LikedPlacesProvider } from "@/components/lists/liked-places-provider";
import type { LikedPlacesSnapshot } from "@/lib/liked-places";
import { brand } from "@/lib/brand";
import { LinkPending } from "./link-pending";

const navigation = [{ href: "/discover", label: "Discover", Icon: Compass }, { href: "/lists", label: "My Lists", Icon: Bookmark }, { href: "/offers", label: "Offers", Icon: Tag }];
function NavigationItems({ mobile = false, pathname, tonight = false }: { mobile?: boolean; pathname: string; tonight?: boolean }) {
  const items = mobile ? [...navigation, { href: "/discover?today=true", label: "Tonight", Icon: Moon }] : navigation;
  return <nav className={mobile ? "mobile-nav" : "desktop-nav"} aria-label={mobile ? "Mobile navigation" : "Main navigation"}>{items.map(({ href, label, Icon }) => {
    const active = href.includes("?") ? tonight : href === "/discover" ? (pathname === "/discover" && !tonight) || pathname === "/places" || pathname.startsWith("/places/") : pathname === href || pathname.startsWith(href + "/");
    return <Link key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={mobile ? 20 : 19} strokeWidth={1.6} /><span>{label}</span>{!mobile && <ArrowUpRight className="nav-arrow" size={14} />}<LinkPending /></Link>;
  })}</nav>;
}
function ActiveNavigation({ mobile = false, pathname }: { mobile?: boolean; pathname: string }) {
  const params = useSearchParams();
  return <NavigationItems mobile={mobile} pathname={pathname} tonight={pathname === "/discover" && params.get("today") === "true"} />;
}
export function AppShell({ children, accountNavigation, likedPlaces }: { children: ReactNode; accountNavigation: ReactNode; likedPlaces?: LikedPlacesSnapshot }) {
  const pathname = usePathname();
  return <LikedPlacesProvider key={likedPlaces?.userId ?? "anonymous"} initial={likedPlaces}>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="site-header">
      <div className="rail-brand"><Link href="/" className="wordmark" aria-label="FoodDude home">{brand.name}<span>.</span></Link><span className="brand-edition">AFTER HOURS</span></div>
      <span className="mobile-location"><MapPin size={13} />Lahore</span>
      <Suspense fallback={<NavigationItems pathname={pathname} />}><ActiveNavigation pathname={pathname} /></Suspense>
      <div className="account-navigation">{accountNavigation}</div>
      <div className="rail-tonight"><Link href="/discover?today=true" className="tonight-link"><Moon size={20} /><span>Tonight</span><ArrowUpRight size={17} /></Link></div>
    </header>
    <div className="app-content"><main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer"><div className="footer-inner container">
        <div className="footer-brand"><Link href="/" className="wordmark">{brand.name}<span>.</span></Link><p>Lahore, Pakistan</p><small>© {new Date().getFullYear()} FoodDude</small></div>
        <nav aria-label="Footer navigation"><Link href="/discover">Discover</Link><Link href="/lists">My Lists</Link><Link href="/offers">Offers</Link></nav>
        <div className="footer-contact"><h2>Contact &amp; Feedback</h2><a href="mailto:faizan3san@gmail.com"><Mail size={15} aria-hidden="true" />faizan3san@gmail.com</a><p>Suggestions, complaints or bug reports.</p></div>
      </div></footer>
    </div>
    <Suspense fallback={<NavigationItems mobile pathname={pathname} />}><ActiveNavigation mobile pathname={pathname} /></Suspense>
  </LikedPlacesProvider>;
}
