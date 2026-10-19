export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return <section className="container admin-placeholder"><p className="eyebrow">BEHIND THE SCENES · COMING LATER</p><h1>{title}</h1><p>{description}</p></section>;
}
