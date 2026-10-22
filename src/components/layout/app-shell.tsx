"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUpRight, Compass, Bookmark, Tag, MapPin, Moon, Sparkles } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { PreviewProvider } from "./preview-provider";
import { brand } from "@/lib/brand";

const navigation = [{ href: "/discover", label: "Discover", Icon: Compass }, { href: "/places", label: "Places", Icon: Bookmark }, { href: "/offers", label: "Offers", Icon: Tag }];
function NavigationItems({ mobile = false, pathname, tonight = false }: { mobile?: boolean; pathname: string; tonight?: boolean }) {
  const items = mobile ? [...navigation, { href: "/discover?today=true", label: "Tonight", Icon: Moon }] : navigation;
  return <nav className={mobile ? "mobile-nav" : "desktop-nav"} aria-label={mobile ? "Mobile navigation" : "Main navigation"}>{items.map(({ href, label, Icon }) => {
    const active = href.includes("?") ? tonight : pathname.startsWith(href) && !(href === "/discover" && tonight);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={mobile ? 20 : 19} strokeWidth={1.6} /><span>{mobile && label === "My Places" ? "Places" : label}</span>{!mobile && <ArrowUpRight className="nav-arrow" size={14} />}</Link>;
  })}</nav>;
}
function ActiveNavigation({ mobile = false, pathname }: { mobile?: boolean; pathname: string }) {
  const params = useSearchParams();
  return <NavigationItems mobile={mobile} pathname={pathname} tonight={pathname === "/discover" && params.get("today") === "true"} />;
}
export function AppShell({ children, accountNavigation }: { children: ReactNode; accountNavigation: ReactNode }) {
  const pathname = usePathname();
  return <PreviewProvider>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="site-header">
      <div className="rail-brand"><Link href="/" className="wordmark" aria-label="FoodDude home">{brand.name}<span>.</span></Link><span className="brand-edition">AFTER HOURS</span></div>
      <span className="mobile-location"><MapPin size={13} />Lahore</span>
      <Suspense fallback={<NavigationItems pathname={pathname} />}><ActiveNavigation pathname={pathname} /></Suspense>
      <div className="account-navigation">{accountNavigation}</div>
      <div className="rail-tonight"><span className="eyebrow">MAKE A NIGHT OF IT</span><Link href="/discover?today=true" className="tonight-link"><Moon size={20} /><span>Tonight</span><ArrowUpRight size={17} /></Link><p>Good company.<br />Somewhere worth going.</p></div>
      <div className="rail-bottom"><Sparkles size={30} strokeWidth={1} /><p>A little appetite.<br />A lot of Lahore.</p><span className="location"><MapPin size={14} /> Lahore, Pakistan</span></div>
    </header>
    <div className="app-content"><main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer container"><div><Link href="/" className="wordmark">{brand.name}<span>.</span></Link><p>{brand.tagline} Only in Lahore.</p></div><p className="demo-disclosure">A personal list, brought to life.<br />Prototype imagery, notes, locations & offers are illustrative and unverified.</p></footer>
    </div>
    <Suspense fallback={<NavigationItems mobile pathname={pathname} />}><ActiveNavigation mobile pathname={pathname} /></Suspense>
  </PreviewProvider>;
}
