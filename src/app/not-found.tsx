import Link from "next/link";
export default function NotFound() {
  return <div className="container empty-state"><h1>Page not found</h1><p>Browse restaurants or check the address.</p><Link className="button button-dark" href="/discover">Back to Discover</Link></div>;
}
