// Offline-only verification. Pass the installed temporary PGlite module path.
// Synthetic fixtures are rolled back and never enter the application seed.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) {
  throw new Error("Pass the path to a temporary @electric-sql/pglite/dist/index.js installation; see docs/data-model.md.");
}
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
let passed = 0;
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [r1, r2, b1, b2, c1, c2, branch1, branch2, source1, source2, run1, offer1, offer2] =
  Array.from({ length: 13 }, (_, i) => uid(i + 1));

const fixtures = `
  insert into public.restaurants(id, name, slug, category) values
    ('${r1}', '__test restaurant A__', 'test-a', 'restaurant'),
    ('${r2}', '__test restaurant B__', 'test-b', 'cafe');
  insert into public.banks(id, name, slug) values
    ('${b1}', '__test bank A__', 'test-bank-a'), ('${b2}', '__test bank B__', 'test-bank-b');
  insert into public.bank_cards(id, bank_id, name, slug) values
    ('${c1}', '${b1}', '__test card__', 'test-card'), ('${c2}', '${b2}', '__test card__', 'test-card');
  insert into public.restaurant_branches(id, restaurant_id) values
    ('${branch1}', '${r1}'), ('${branch2}', '${r2}');
  insert into public.scrape_sources(id, name, source_url, scraper_key) values
    ('${source1}', '__test source A__', 'https://example.invalid/a', 'test'),
    ('${source2}', '__test source B__', 'https://example.invalid/b', 'test');
  insert into public.scrape_runs(id, scrape_source_id) values ('${run1}', '${source1}');
`;

const restaurantOffer = (extraColumns = "", extraValues = "", id = offer1) => `
  insert into public.offers(id, restaurant_id, offer_type, title, discount_type,
    applies_to_all_branches, applies_every_day${extraColumns})
  values ('${id}', '${r1}', 'restaurant', '__test promotion__', 'other', true, true${extraValues});
`;
const bankOffer = (scope = "selected_cards") => `
  insert into public.offers(id, restaurant_id, offer_type, bank_id, card_scope,
    title, discount_type, applies_to_all_branches, applies_every_day)
  values ('${offer1}', '${r1}', 'bank', '${b1}', '${scope}', '__test promotion__', 'percentage', true, true);
`;
const cardLink = `insert into public.offer_cards values ('${offer1}', '${c1}', '${b1}');`;
const branchLink = `insert into public.offer_branches values ('${offer1}', '${branch1}', '${r1}');`;

async function check(name, sql, expectedCode) {
  await db.exec("begin;");
  try {
    await db.exec(fixtures);
    await db.exec(sql);
    await db.exec("set constraints all immediate;");
    if (expectedCode) assert.fail(`${name}: expected SQLSTATE ${expectedCode}`);
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    if (!expectedCode || ![expectedCode].flat().includes(error.code)) {
      throw new Error(`${name}: ${error.code ?? "assertion"} ${error.message}`);
    }
    passed++;
    console.log(`PASS ${name} (rejected: ${expectedCode})`);
  } finally {
    await db.exec("rollback;");
  }
}

try {
  const migration = await readFile(new URL("../supabase/migrations/001_initial_schema.sql", import.meta.url), "utf8");
  const seed = await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8");
  await db.exec(migration);
  const tables = await db.query("select tablename from pg_tables where schemaname = 'public'");
  assert.equal(tables.rows.length, 14);
  await db.exec(seed);
  const firstSeed = await db.query("select id, slug, name, category from public.restaurants order by slug");
  await db.exec(seed);
  const secondSeed = await db.query("select id, slug, name, category from public.restaurants order by slug");
  assert.deepEqual(firstSeed.rows, secondSeed.rows);
  const tsSeed = await readFile(new URL("../src/data/restaurants.seed.ts", import.meta.url), "utf8");
  const expected = Array.from(tsSeed.matchAll(/\{ id: "([^"]+)", name: ("(?:[^"\\]|\\.)*"), category: "(restaurant|cafe)" \}/g),
    (match) => ({ slug: match[1], name: JSON.parse(match[2]), category: match[3] }));
  assert.equal(expected.length, 74);
  assert.equal(expected.filter((row) => row.category === "restaurant").length, 55);
  assert.equal(expected.filter((row) => row.category === "cafe").length, 19);
  assert.deepEqual(secondSeed.rows.map(({ slug, name, category }) => ({ slug, name, category })),
    expected.sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  assert.equal((await db.query(`select count(*)::int as n from public.restaurants
    where short_description is not null or personal_notes is not null or price_level is not null
       or instagram_url is not null or website_url is not null or is_favorite or not is_active`)).rows[0].n, 0);
  for (const { tablename } of tables.rows.filter(({ tablename }) => tablename !== "restaurants")) {
    assert.equal((await db.query(`select count(*)::int as n from public.${tablename}`)).rows[0].n, 0);
  }
  console.log("PASS migration: 14 tables; seed: 74 exact entries, unchanged UUIDs on rerun, no fabricated details");
  passed++;

  await check("non-bank nonnumeric offer", restaurantOffer());
  await check("nullable monetary/date fields", restaurantOffer() + `update public.offers set discount_type = 'fixed' where id = '${offer1}';`);
  await check("percentage with cap", restaurantOffer() + `update public.offers set discount_type = 'percentage', discount_value = 25, maximum_discount = 3000 where id = '${offer1}';`);
  await check("fixed with minimum spend", restaurantOffer() + `update public.offers set discount_type = 'fixed', discount_value = 1000, minimum_spend = 5000 where id = '${offer1}';`);
  await check("percentage above 100", restaurantOffer() + `update public.offers set discount_type = 'percentage', discount_value = 101;`, "23514");
  for (const column of ["discount_value", "minimum_spend", "maximum_discount"]) {
    await check(`negative ${column}`, restaurantOffer() + `update public.offers set ${column} = -1;`, "23514");
    await check(`NaN ${column}`, restaurantOffer() + `update public.offers set ${column} = 'NaN';`, "23514");
  }
  await check("reversed dates", restaurantOffer(", start_date, expiry_date", ", '2026-10-17', '2026-10-16'"), "23514");
  await check("same-day validity", restaurantOffer(", start_date, expiry_date", ", '2026-10-17', '2026-10-17'"));
  await check("out-of-range coordinates", `update public.restaurant_branches set latitude = 91, longitude = 0 where id = '${branch1}';`, "23514");
  await check("partial coordinate pair", `update public.restaurant_branches set latitude = 31 where id = '${branch1}';`, "23514");
  await check("price bounds", `update public.restaurants set price_level = 5 where id = '${r1}';`, "23514");
  await check("valid image", `insert into public.restaurant_images(restaurant_id, branch_id, storage_path) values ('${r1}', '${branch1}', '__test__/image');`);
  await check("cross-restaurant image", `insert into public.restaurant_images(restaurant_id, branch_id, storage_path) values ('${r1}', '${branch2}', '__test__/image');`, "23503");
  await check("missing image locator", `insert into public.restaurant_images(restaurant_id) values ('${r1}');`, "23514");
  await check("two image locators", `insert into public.restaurant_images(restaurant_id, storage_path, image_url) values ('${r1}', '__test__/image', 'https://example.invalid/image');`, "23514");
  await check("duplicate cover", `insert into public.restaurant_images(restaurant_id, storage_path, is_cover) values ('${r1}', '__test__/a', true), ('${r1}', '__test__/b', true);`, "23505");
  await check("selected cards saved atomically", bankOffer() + cardLink);
  await check("bank-wide eligibility", bankOffer("all_bank_cards"));
  await check("missing selected card", bankOffer(), "23514");
  await check("bank-wide with card rows", bankOffer("all_bank_cards") + cardLink, "23514");
  await check("bank offer missing bank", restaurantOffer() + `update public.offers set offer_type = 'bank';`, "23514");
  await check("non-bank with bank identity", restaurantOffer(", bank_id", `, '${b1}'`), "23514");
  await check("cross-bank card", bankOffer() + `insert into public.offer_cards values ('${offer1}', '${c2}', '${b1}');`, "23503");
  await check("duplicate card link", bankOffer() + cardLink + cardLink, "23505");
  await check("selected branch", restaurantOffer() + `update public.offers set applies_to_all_branches = false;` + branchLink);
  await check("missing selected branch", restaurantOffer() + `update public.offers set applies_to_all_branches = false;`, "23514");
  await check("all branches with links", restaurantOffer() + branchLink, "23514");
  await check("cross-restaurant branch", restaurantOffer() + `insert into public.offer_branches values ('${offer1}', '${branch2}', '${r1}');`, "23503");
  await check("Friday through Sunday", restaurantOffer() + `update public.offers set applies_every_day = false;
    insert into public.offer_valid_days values ('${offer1}', 5), ('${offer1}', 6), ('${offer1}', 0);`);
  await check("missing selected weekdays", restaurantOffer() + `update public.offers set applies_every_day = false;`, "23514");
  await check("every day with rows", restaurantOffer() + `insert into public.offer_valid_days values ('${offer1}', 1);`, "23514");
  await check("invalid weekday", restaurantOffer() + `insert into public.offer_valid_days values ('${offer1}', 7);`, "23514");
  await check("duplicate weekday", restaurantOffer() + `insert into public.offer_valid_days values ('${offer1}', 1), ('${offer1}', 1);`, "23505");
  await check("deleting final selected card", bankOffer() + cardLink + `delete from public.bank_cards where id = '${c1}';`, "23514");
  await check("deleting final selected branch", restaurantOffer() + `update public.offers set applies_to_all_branches = false;` + branchLink + `delete from public.restaurant_branches where id = '${branch1}';`, "23514");
  await check("deleting final selected weekday", restaurantOffer() + `update public.offers set applies_every_day = false;
    insert into public.offer_valid_days values ('${offer1}', 5); delete from public.offer_valid_days;`, "23514");
  await check("moving junction checks old offer", bankOffer() + cardLink + restaurantOffer("", "", offer2) +
    `update public.offers set offer_type = 'bank', bank_id = '${b1}', card_scope = 'selected_cards' where id = '${offer2}';
     update public.offer_cards set offer_id = '${offer2}' where offer_id = '${offer1}';`, "23514");
  await check("scope transition in transaction", bankOffer() + cardLink + `delete from public.offer_cards; update public.offers set card_scope = 'all_bank_cards';`);
  await check("bank deletion restricted", bankOffer("all_bank_cards") + `delete from public.banks where id = '${b1}';`, ["23001", "23503"]);
  await check("source and run provenance", restaurantOffer(", scrape_source_id, last_scrape_run_id", `, '${source1}', '${run1}'`));
  await check("mismatched run source", restaurantOffer(", scrape_source_id, last_scrape_run_id", `, '${source2}', '${run1}'`), "23503");
  await check("reference without source", restaurantOffer(", external_reference", ", '__test__'"), "23514");
  await check("duplicate source identity", restaurantOffer(", scrape_source_id, external_reference", `, '${source1}', '__test__'`) + restaurantOffer(", scrape_source_id, external_reference", `, '${source1}', '__test__'`, offer2), "23505");
  await check("source deletion restricted", `delete from public.scrape_sources where id = '${source1}';`, ["23001", "23503"]);
  await check("run deletion restricted", restaurantOffer(", scrape_source_id, last_scrape_run_id", `, '${source1}', '${run1}'`) + `delete from public.scrape_runs where id = '${run1}';`, ["23001", "23503"]);
  await check("terminal run needs timestamp", `update public.scrape_runs set status = 'success';`, "23514");
  await check("terminal run with timestamp", `update public.scrape_runs set status = 'partial', completed_at = clock_timestamp();`);
  await check("negative scraper count", `update public.scrape_runs set offers_found = -1;`, "23514");
  await check("truncate cannot bypass scope checks", restaurantOffer() + `truncate public.offer_valid_days;`, "P0001");
  await check("updated_at maintained", `update public.restaurants set updated_at = '2000-01-01' where id = '${r1}';
    do $$ begin if exists(select 1 from public.restaurants where id = '${r1}' and updated_at = '2000-01-01') then raise exception 'timestamp not maintained'; end if; end $$;`);
  await check("restaurant cascade cleans dependents and preserves shared data", bankOffer() + cardLink + `
    update public.offers set applies_to_all_branches = false, applies_every_day = false;
    ${branchLink}
    insert into public.offer_valid_days values ('${offer1}', 5);
    insert into public.restaurant_images(restaurant_id, branch_id, storage_path) values ('${r1}', '${branch1}', '__test__/image');
    insert into public.restaurant_recommendations(restaurant_id, title) values ('${r1}', '__test__');
    insert into public.tags(id, name, slug) values ('${uid(99)}', '__test__', 'test-tag');
    insert into public.restaurant_tags values ('${r1}', '${uid(99)}');
    delete from public.restaurants where id = '${r1}';
    do $$ begin
      if exists(select 1 from public.offers where id = '${offer1}')
        or exists(select 1 from public.restaurant_branches where restaurant_id = '${r1}')
        or exists(select 1 from public.restaurant_images where restaurant_id = '${r1}')
        or exists(select 1 from public.restaurant_recommendations where restaurant_id = '${r1}')
        or exists(select 1 from public.restaurant_tags where restaurant_id = '${r1}')
        or exists(select 1 from public.offer_cards where offer_id = '${offer1}')
        or exists(select 1 from public.offer_branches where offer_id = '${offer1}')
        or exists(select 1 from public.offer_valid_days where offer_id = '${offer1}')
        then raise exception 'cascade left orphan data'; end if;
      if not exists(select 1 from public.banks where id = '${b1}')
        or not exists(select 1 from public.tags where id = '${uid(99)}')
        or not exists(select 1 from public.scrape_runs where id = '${run1}')
        then raise exception 'shared data lost'; end if;
    end $$;
  `);
  assert.equal((await db.query("select count(*)::int as n from public.restaurants")).rows[0].n, 74);
  console.log(`All ${passed} offline schema checks passed. No live database used.`);
} finally {
  await db.close();
}
