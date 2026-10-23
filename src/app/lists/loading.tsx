export default function Loading() {
  return <div className="container lists-page" aria-busy="true"><header className="lists-heading"><h1>My Lists<span>.</span></h1><p role="status">Loading lists…</p></header><div className="collection-grid" aria-hidden="true">{[0, 1, 2].map(id => <div className="collection-card list-skeleton" key={id} />)}</div></div>;
}
