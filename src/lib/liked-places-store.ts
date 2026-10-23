import type { LikedPlacesSnapshot, LikeResult } from "./liked-places";

export function createLikedPlacesStore(initial: LikedPlacesSnapshot, actions: { read: () => Promise<LikedPlacesSnapshot>; set: (id: string, liked: boolean) => Promise<LikeResult> }) {
  let state = { ...initial, pendingId: null as string | null, message: "", error: "" };
  let revision = 0;
  let notify: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  const store = {
    getSnapshot: () => state,
    getServerSnapshot: () => initialState,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    replace(snapshot: LikedPlacesSnapshot) {
      if (!state.pendingId) { state = { ...state, ...snapshot }; publish(); }
    },
    clear() { state = { ...state, message: "", error: "" }; publish(); },
    async refresh() {
      if (state.pendingId) return;
      const version = revision;
      try { const snapshot = await actions.read(); if (version === revision && !state.pendingId) store.replace(snapshot); } catch { /* Keep the last verified state; a manual refresh can retry. */ }
    },
    async set(restaurantId: string, liked: boolean) {
      if (state.pendingId || !state.userId) return;
      revision++;
      state = { ...state, pendingId: restaurantId, message: "", error: "" }; publish();
      try {
        const result = await actions.set(restaurantId, liked);
        if (result.error) state = { ...state, error: result.error };
        else if (result.snapshot) {
          const restaurantIds = result.snapshot.unavailable ? [...new Set(liked ? [...state.restaurantIds, restaurantId] : state.restaurantIds.filter(id => id !== restaurantId))] : result.snapshot.restaurantIds;
          state = { ...state, ...result.snapshot, restaurantIds, message: result.snapshot.unavailable ? "Saved. Reload to confirm your latest likes." : liked ? "Added to Liked Places." : "Removed from Liked Places." };
          notify?.();
        }
      } catch { state = { ...state, error: "Unable to update Liked Places. Please try again." }; }
      finally { state = { ...state, pendingId: null }; publish(); }
    },
    setNotifier(callback?: () => void) { notify = callback; },
  };
  const initialState = state;
  return store;
}
