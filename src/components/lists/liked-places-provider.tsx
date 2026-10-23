"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { readLikedPlaces, setRestaurantLiked } from "@/app/lists/like-actions";
import { createLikedPlacesStore } from "@/lib/liked-places-store";
import { anonymousLikes, type LikedPlacesSnapshot } from "@/lib/liked-places";


const LikedContext = createContext<ReturnType<typeof createLikedPlacesStore> | null>(null);
const fallback = createLikedPlacesStore(anonymousLikes, { read: readLikedPlaces, set: setRestaurantLiked });
export function LikedPlacesProvider({ initial = anonymousLikes, children }: { initial?: LikedPlacesSnapshot; children: ReactNode }) {
  const router = useRouter();
  const [store] = useState(() => createLikedPlacesStore(initial, { read: readLikedPlaces, set: setRestaurantLiked }));
  useEffect(() => { store.replace(initial); }, [store, initial]);
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const before = store.getSnapshot();
      await store.refresh();
      const after = store.getSnapshot();
      if (before.userId !== after.userId || before.restaurantIds.join(",") !== after.restaurantIds.join(",")) router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("fooddude-liked-places") : null;
    if (channel) { channel.onmessage = refresh; store.setNotifier(() => channel.postMessage("changed")); }
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); store.setNotifier(); channel?.close(); };
  }, [store, router]);
  return <LikedContext.Provider value={store}>{children}<LikedFeedback /></LikedContext.Provider>;
}
function LikedFeedback() {
  const store = useContext(LikedContext)!;
  const { message, error } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return <div className="liked-feedback" aria-live="polite" aria-atomic="true">{(message || error) && <div><p role={error ? "alert" : undefined}>{error || message}</p><button type="button" onClick={store.clear} aria-label="Dismiss like feedback">×</button></div>}</div>;
}
export function useLikedPlaces() {
  const store = useContext(LikedContext) ?? fallback;
  return { ...useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot), setLiked: store.set, refreshLikes: store.refresh };
}
