import Link from "next/link";
export default function NotFound() {
  return <section className="container lists-page"><h1>List unavailable.</h1><p>This list may have been deleted or may not belong to your account.</p><Link href="/lists" className="button button-dark">Return to My Lists</Link></section>;
}
