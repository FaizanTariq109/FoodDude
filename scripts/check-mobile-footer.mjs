// Validate geometry captured from the actual local Next.js app in a browser.
// Usage: node scripts/check-mobile-footer.mjs <browser-measurements.json>
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const layouts = JSON.parse(await readFile(process.argv[2], "utf8"));
for (const width of [320, 390, 430, 768, 834, 1440, 1920, 2560]) {
  assert(layouts.some(row => row.width === width), `Missing viewport ${width}`);
}
assert(layouts.some(row => row.simulatedInset === 34), "Missing simulated safe-area coverage");
for (const row of layouts) {
  const context = `${row.width}px / inset ${row.simulatedInset ?? 0}`;
  assert(row.scrollWidth <= row.clientWidth, `${context}: horizontal overflow`);
  assert(Math.abs(row.footerBottom - row.documentHeight) < 1, `${context}: uncovered document space below footer`);
  assert(Math.abs(row.footerLeft - row.appLeft) < 1 && Math.abs(row.footerRight - row.appRight) < 1, `${context}: footer width/rail regression`);
  assert.equal(row.bodyPaddingBottom, 0, `${context}: body creates trailing space`);
  if (row.width <= 900) {
    assert(row.navHeight > 60, `${context}: fixed navigation missing`);
    assert(row.footerPaddingBottom >= row.navHeight - 1, `${context}: insufficient navigation clearance`);
    assert(row.footerPaddingBottom <= row.navHeight + 1, `${context}: excess empty clearance`);
    assert(row.footerContentBottom <= row.documentHeight - row.navHeight - 15, `${context}: footer contact or links obscured`);
  } else {
    assert.equal(row.navHeight, 0, `${context}: mobile navigation visible on desktop`);
    assert.equal(row.footerPaddingBottom, 0, `${context}: mobile reserve applied to desktop`);
    assert(row.appLeft > 0, `${context}: desktop sidebar lost`);
  }
}
console.log(`PASS ${layouts.length} actual browser layouts: footer reaches document end, links clear fixed navigation, exact mobile/safe-area reserve, no horizontal overflow, desktop rail/footer preserved`);
