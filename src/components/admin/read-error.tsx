export function AdminReadError({ href }: { href: string }) {
  return <div className="admin-empty" role="alert">
    <h2>Restaurant records are unavailable</h2>
    <p>We couldn’t load the catalogue. Try again shortly. If this continues, ask your administrator to check catalogue access and the database migration.</p>
    <a className="button button-dark" href={href}>Try again</a>
  </div>;
}
