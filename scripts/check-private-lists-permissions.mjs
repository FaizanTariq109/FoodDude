// Verify read-only CLI metadata exports; never connects to hosted user data.
// Usage: node scripts/check-private-lists-permissions.mjs before.json after.json security.json
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = async path => JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
const [before, after, security] = await Promise.all(process.argv.slice(2).map(read));
assert.deepEqual(after.rows[0].security_snapshot, before.rows[0].security_snapshot);
console.log("PASS existing hosted table/column grants, RLS, policies and function definitions/ACLs unchanged");
const s = security.rows[0].private_lists_security;
assert.equal(s.tables.length, 2);
for (const table of s.tables) { assert.equal(table.rls, true); assert.equal(table.owner, "postgres"); }
assert.equal(s.roles.length, 2);
for (const role of s.roles) { assert.equal(role.superuser, false); assert.equal(role.bypass_rls, false); }
assert.equal(s.policies.length, 8);
for (const table of ["user_lists", "user_list_entries"]) {
  assert.deepEqual(s.policies.filter(p => p.tablename === table).map(p => p.cmd).sort(), ["DELETE", "INSERT", "SELECT", "UPDATE"]);
}
for (const policy of s.policies) {
  assert.deepEqual(policy.roles, ["authenticated"]);
  for (const clause of [policy.qual, policy.with_check].filter(Boolean)) {
    assert.match(clause, /owner_id\s*=.*SELECT auth\.uid\(\)/s);
    assert.doesNotMatch(clause, /is_admin|admin_membership|\bOR\b/i);
  }
}
assert.match(s.policies.find(p => p.policyname === "entries_insert_own_public").with_check, /FROM restaurants r/);
assert.equal(s.columns.length, 24);
for (const column of s.columns) {
  const auth = column.role === "authenticated";
  const insert = column.table === "user_lists" ? ["name", "description"] : ["list_id", "restaurant_id", "notes"];
  const update = column.table === "user_lists" ? ["name", "description"] : ["notes"];
  assert.equal(column.select, auth);
  assert.equal(column.insert, auth && insert.includes(column.column));
  assert.equal(column.update, auth && update.includes(column.column));
}
assert.equal(s.table_privileges.length, 4);
for (const p of s.table_privileges) {
  assert.equal(p.delete, p.role === "authenticated");
  for (const key of ["truncate", "references", "trigger"]) assert.equal(p[key], false);
}
for (const expected of [/UNIQUE \(list_id, restaurant_id\)/, /FOREIGN KEY \(owner_id\) REFERENCES profiles\(id\) ON DELETE CASCADE/, /FOREIGN KEY \(list_id\) REFERENCES user_lists\(id\) ON DELETE CASCADE/, /FOREIGN KEY \(restaurant_id\) REFERENCES restaurants\(id\) ON DELETE RESTRICT/]) {
  assert.ok(s.constraints.some(c => expected.test(c.definition)), String(expected));
}
console.log("PASS hosted owner-only policies, no application admin bypass, exact column grants, anonymous denial and safe FK/uniqueness constraints");
