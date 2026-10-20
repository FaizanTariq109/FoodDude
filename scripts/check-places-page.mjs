// Offline page-boundary checks: no network, cookies, or credentials required.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
let fail = false;
const records = [{ id: "database-id", name: "Database name", slug: "database-slug", category: "cafe" }];
const Explorer = () => null;
const mocks = {
  "next/server": { connection: async () => {} },
  "@/components/discovery/explorer": { Explorer },
  "@/lib/data/restaurants": { getRestaurants: async () => {
    if (fail) throw new Error("Simulated database failure");
    return records;
  } },
  "@/data/prototype/restaurants": { enrichRestaurants: rows => rows },
};
const code = ts.transpileModule(fs.readFileSync(new URL("../src/app/places/page.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const record = { exports: {} };
new Function("require", "module", "exports", code)(id => mocks[id] ?? require(id), record, record.exports);
const renderList = () => record.exports.default().props.children.type();
const success = await renderList();
assert.equal(success.type, Explorer);
assert.equal(success.props.source, records);
fail = true;
const failure = await renderList();
const { renderToStaticMarkup } = require("react-dom/server");
const html = renderToStaticMarkup(failure);
assert.match(html, /role="alert"/);
assert.match(html, /temporarily unavailable/);
assert.match(html, /href="\/places"/);
assert.doesNotMatch(html, /Database name|restaurant-grid/);
console.log("Places page checks passed: server records reach Explorer; failed reads show an alert and retry without seed fallback.");
