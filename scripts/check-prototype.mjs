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
const { places } = load(path.join(root, 'src/data/prototype/restaurants.ts'));
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
console.log('Prototype checks passed: seed counts, search, combined/group filters, branches, likes, percentages, weekday and date boundaries.');
