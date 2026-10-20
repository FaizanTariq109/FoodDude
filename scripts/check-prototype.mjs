// Offline behavioral checks using the project's existing TypeScript compiler.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('..', import.meta.url));
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const record = { exports: {} };
  cache.set(file, record);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = id => id.startsWith('@/')
    ? load(path.join(root, 'src', id.slice(2) + '.ts')) : (() => { throw new Error('Unexpected import: ' + id); })();
  new Function('require', 'module', 'exports', code)(localRequire, record, record.exports);
  return record.exports;
}
const { defaultFilters, filterPlaces, offerMatches } = load(path.join(root, 'src/lib/discovery.ts'));
const { demoOffers, isOfferValid } = load(path.join(root, 'src/data/prototype/offers.ts'));
const { places, enrichRestaurants } = load(path.join(root, 'src/data/prototype/restaurants.ts'));
const filters = patch => ({ ...defaultFilters, ...patch });
const find = patch => filterPlaces(filters(patch), '2026-10-19', []).map(p => p.slug);
assert.equal(places.length, 74);
assert.equal(find({ category: 'restaurant' }).length, 55);
assert.equal(find({ category: 'cafe' }).length, 19);
assert.deepEqual(find({ q: 'cafe bru' }), ['cafe-bru']);
assert.deepEqual(find({ bank: 'meezan', min: '30' }), ['basilico-by-sara']);
assert.deepEqual(find({ bank: 'allied', today: true }), ['jhonny-jhugnu']);
assert.deepEqual(find({ card: 'allied-classic,meezan-student', today: true, sort: 'discount' }), ['basilico-by-sara', 'brewscape', 'jhonny-jhugnu']);
assert.deepEqual(find({ q: 'fuoco', area: 'DHA', bank: 'allied' }), []);
assert.deepEqual(find({ q: 'fuoco', area: 'Gulberg', bank: 'allied' }), ['fuoco']);
assert.deepEqual(find({ q: 'no such restaurant' }), []);
assert.deepEqual(filterPlaces(filters({ liked: true }), null, ['fuoco']).map(p => p.slug), ['fuoco']);
const fixed = demoOffers.find(o => o.id === 'demo-jhonny');
assert.equal(offerMatches(fixed, filters({ min: '10' }), null), false);
const everyday = demoOffers.find(o => o.id === 'demo-basilico-meezan');
assert.equal(isOfferValid(everyday, '2027-12-31'), true);
assert.equal(isOfferValid(everyday, '2028-01-01'), false);
assert.equal(isOfferValid(everyday, '2025-12-31'), false);
const weekend = demoOffers.find(o => o.id === 'demo-fuoco-allied');
assert.equal(isOfferValid(weekend, '2026-10-18'), true);
assert.equal(isOfferValid(weekend, '2026-10-19'), false);
// Database identities must survive prototype enrichment and filtering.
const canonical = [
  { id: '00000000-0000-4000-8000-000000000001', slug: 'fuoco', name: 'Canonical renamed cafe', category: 'cafe' },
  { id: '00000000-0000-4000-8000-000000000002', slug: 'new-public-place', name: 'A new restaurant', category: 'restaurant' },
];
const enriched = enrichRestaurants(canonical);
assert.equal(enriched.length, 2);
assert.deepEqual(enriched.map(({ id, name, slug, category }) => ({ id, name, slug, category })), canonical);
assert.ok(enriched[0].demo?.photo);
assert.equal(enriched[1].demo, undefined);
assert.deepEqual(filterPlaces(filters({ category: 'cafe' }), null, [], enriched).map(p => p.name), ['Canonical renamed cafe']);
assert.deepEqual(filterPlaces(filters({ q: 'renamed' }), null, [], enriched).map(p => p.id), [canonical[0].id]);
assert.deepEqual(filterPlaces(filters({ liked: true }), null, ['fuoco'], enriched).map(p => p.slug), ['fuoco']);
assert.deepEqual(filterPlaces(filters({ sort: 'az' }), null, [], enriched).map(p => p.slug), ['new-public-place', 'fuoco']);
assert.deepEqual(filterPlaces(filters({}), null, [], enrichRestaurants([])), []);
console.log('Prototype checks passed: seed counts, search, combined/group filters, branches, likes, percentages, weekday and date boundaries.');
console.log('Canonical list checks passed: database identity preserved, slug enrichment, new records, filters, sorting, likes, and no seed fallback.');
