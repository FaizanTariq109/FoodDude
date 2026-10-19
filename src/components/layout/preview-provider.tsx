"use client";
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { places } from "@/data/prototype/restaurants";

const PreviewContext = createContext<{ favorites: string[]; toggleFavorite: (slug: string) => void }>({ favorites: [], toggleFavorite: () => {} });
export function PreviewProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState(places.filter(p => p.demo?.favorite).map(p => p.slug));
  return <PreviewContext.Provider value={{ favorites, toggleFavorite: slug => setFavorites(previous => previous.includes(slug) ? previous.filter(id => id !== slug) : [...previous, slug]) }}>{children}</PreviewContext.Provider>;
}
export const usePreview = () => useContext(PreviewContext);
const subscribe = (callback: () => void) => { const timer = setInterval(callback, 60000); return () => clearInterval(timer); };
const getDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function useLahoreDate() { return useSyncExternalStore(subscribe, getDate, () => null); }
