import Link from "next/link";
export default function NotFound() {
  return <div className="container empty-state"><p className="eyebrow">A SMALL DETOUR</p><h1>This place isn’t on the list.</h1><p>Let’s find you somewhere else to go.</p><Link className="button button-dark" href="/discover">Back to Discover</Link></div>;
}
