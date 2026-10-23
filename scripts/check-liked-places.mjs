// Actual action/data/store modules with synthetic transports; no hosted writes.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url), React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const userId = "00000000-0000-4000-8000-000000000001", restaurantId = "10000000-0000-4000-8000-000000000001", listId = "20000000-0000-4000-8000-000000000001";
let authenticated = true, readError = false, rpcError = false, ids = [], calls = [], invalidations = [];
let ui = { userId, restaurantIds: [], unavailable: false, pendingId: null, setLiked() {}, refreshLikes() {} };
const client = {
  auth: { getClaims: async () => ({ data: { claims: authenticated ? { sub: userId } : {} }, error: null }) },
  rpc: async (name, args) => { calls.push({ name, args }); if (!rpcError) ids = args.p_liked ? [...new Set([...ids, args.p_restaurant_id])] : ids.filter(id => id !== args.p_restaurant_id); return { data: args.p_liked, error: rpcError ? { message: "SECRET" } : null }; },
  from(table) {
    const call = { table, filters: [], start: 0, end: 99 }; calls.push(call);
    const result = () => ({ data: readError ? null : table === "user_lists" ? [{ id: listId, name: "Liked Places", kind: "liked", description: null }, { id: userId, name: "Custom", kind: "custom", description: null }] : ids.slice(call.start, call.end + 1).map(restaurant_id => ({ restaurant_id, list_id: listId })), error: readError ? { message: "SECRET" } : null });
    const chain = { select(columns) { call.columns = columns; return chain; }, eq(...args) { call.filters.push(args); return chain; }, order() { return chain; }, range(a, b) { call.start = a; call.end = b; return chain; }, abortSignal() { return chain; }, maybeSingle: async () => ({ ...result(), data: result().data?.[0] ?? null }), then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); } };
    return chain;
  },
};
const mocks = {
  "server-only": {}, "next/link": { __esModule: true, default: "a" },
  "@/lib/supabase/server": { createClient: async () => client },
  "@/components/lists/liked-places-provider": { useLikedPlaces: () => ui },
  "./liked-places-provider": { useLikedPlaces: () => ui },
  "next/cache": { revalidatePath: (...args) => invalidations.push(args) },
  "next/navigation": { useRouter: () => ({ refresh() {} }) },
};
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/") || id.startsWith(".")) {
      const base = id.startsWith("@/") ? path.resolve("src", id.slice(2)) : path.resolve(path.dirname(file), id);
      return load(fs.existsSync(base + ".ts") ? base + ".ts" : base + ".tsx");
    }
    return require(id);
  }, mod, mod.exports);
  modules.set(file, mod.exports); return mod.exports;
}
const { getLikedPlaces } = load(path.resolve("src/lib/data/liked-places.ts"));
const { setRestaurantLiked, readLikedPlaces } = load(path.resolve("src/app/lists/like-actions.ts"));
authenticated = false;
assert.deepEqual(await getLikedPlaces(), { userId: null, restaurantIds: [], unavailable: false });
assert.match((await setRestaurantLiked(restaurantId, true)).error, /sign in/); assert.equal(calls.length, 0);
authenticated = true;
assert.ok((await setRestaurantLiked("bad", true)).error); assert.ok((await setRestaurantLiked(restaurantId, "true")).error); assert.equal(calls.length, 0);
let result = await setRestaurantLiked(restaurantId, true);
assert.deepEqual(result.snapshot.restaurantIds, [restaurantId]);
assert.deepEqual(calls.find(call => call.name)?.args, { p_restaurant_id: restaurantId, p_liked: true });
assert.ok(invalidations.some(([p, kind]) => p === "/" && kind === "layout"));
assert.ok(calls.some(call => call.table === "user_lists" && call.filters.some(([key, value]) => key === "kind" && value === "liked")));
assert.ok(calls.filter(call => call.table === "user_list_entries").every(call => call.columns === "restaurant_id"));
assert.deepEqual((await readLikedPlaces()).restaurantIds, [restaurantId]);
assert.deepEqual((await setRestaurantLiked(restaurantId, false)).snapshot.restaurantIds, []);
rpcError = true; assert.doesNotMatch((await setRestaurantLiked(restaurantId, true)).error, /SECRET/); rpcError = false;
readError = true; assert.deepEqual(await getLikedPlaces(), { userId, restaurantIds: [], unavailable: true }); readError = false;
ids = Array.from({ length: 205 }, (_, index) => String(index)); assert.equal((await getLikedPlaces()).restaurantIds.length, 205);
console.log("PASS verified own-session reads, discriminator lookup, paginated private membership projection, anonymous/input rejection, explicit idempotent RPC payload, revalidation and safe failures");

const { FavoriteButton } = load(path.resolve("src/components/lists/favorite-button.tsx"));
const heart = () => renderToStaticMarkup(React.createElement(FavoriteButton, { restaurantId, name: "Test Cafe", large: true }));
assert.match(heart(), /aria-pressed="false"/); assert.doesNotMatch(heart(), /prototype|preview session/i);
ui.restaurantIds = [restaurantId]; assert.match(heart(), /aria-pressed="true"/); assert.match(heart(), /Unlike Test Cafe/);
ui.pendingId = restaurantId; assert.match(heart(), /disabled=""/); assert.match(heart(), /Saving like for Test Cafe/);
ui.pendingId = null; ui.userId = null; assert.match(heart(), /aria-haspopup="dialog"/); assert.doesNotMatch(heart(), /aria-pressed="true"/);
ui.unavailable = true; assert.match(heart(), /Retry Liked Places/);
const { ListOverview } = load(path.resolve("src/components/lists/list-overview.tsx"));
const special = { id: listId, name: "Liked Places", description: null, kind: "liked", restaurantCount: 1 };
assert.match(renderToStaticMarkup(React.createElement(ListOverview, { lists: [special] })), /Default favorites/);
const { ListDetail } = load(path.resolve("src/components/lists/list-detail.tsx"));
const detail = renderToStaticMarkup(React.createElement(ListDetail, { list: special, entries: [{ id: userId, restaurant_id: restaurantId, notes: "Private note" }], restaurants: [] }));
assert.doesNotMatch(detail, /Edit list title|Delete Liked Places/); assert.match(detail, /Private note/); assert.match(detail, /Edit private note/); assert.match(detail, /Remove Restaurant unavailable/);
ids = [];
const { SaveRestaurant } = load(path.resolve("src/components/lists/save-restaurant.tsx"));
assert.ok((await SaveRestaurant({ restaurantId })).props.lists.every(list => list.kind === "custom"));
console.log("PASS persisted heart rendering, pending/anonymous/retry states, default badge, protected default controls, private notes/removal on unavailable references and custom-only Save to List destinations");

const { createLikedPlacesStore } = load(path.resolve("src/lib/liked-places-store.ts"));
const initial = { userId, restaurantIds: [], unavailable: false };
let finish, refreshFinish, setCalls = 0;
const store = createLikedPlacesStore(initial, { read: () => new Promise(resolve => { refreshFinish = resolve; }), set: () => { setCalls++; return new Promise(resolve => { finish = resolve; }); } });
const refresh = store.refresh();
const pending = store.set(restaurantId, true);
await store.set(restaurantId, true); await store.set(listId, true); assert.equal(setCalls, 1);
assert.equal(store.getSnapshot().pendingId, restaurantId);
store.replace({ ...initial, restaurantIds: ["stale"] }); assert.deepEqual(store.getSnapshot().restaurantIds, []);
finish({ snapshot: { ...initial, restaurantIds: [restaurantId] } }); await pending;
refreshFinish({ ...initial, restaurantIds: ["stale"] }); await refresh;
assert.deepEqual(store.getSnapshot().restaurantIds, [restaurantId]); assert.equal(store.getSnapshot().pendingId, null);
assert.match(store.getSnapshot().message, /Added/);
const failed = createLikedPlacesStore({ ...initial, restaurantIds: [restaurantId] }, { read: async () => initial, set: async () => { throw Error("network"); } });
await failed.set(restaurantId, false); assert.deepEqual(failed.getSnapshot().restaurantIds, [restaurantId]); assert.ok(failed.getSnapshot().error); assert.equal(failed.getSnapshot().pendingId, null);
failed.replace({ userId: null, restaurantIds: [], unavailable: false }); assert.equal(failed.getSnapshot().userId, null); assert.deepEqual(failed.getSnapshot().restaurantIds, []);
console.log("PASS shared-store synchronization, rapid-click/in-flight guard, stale refresh protection, verified success, failure rollback, pending cleanup and account-state reset");
