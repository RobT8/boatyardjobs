import assert from "node:assert/strict";
import { htmlContainsBadge } from "../../src/lib/badge-placements";
import { BADGE_STYLES, renderBadge, badgeStyle } from "../../src/lib/badge";

/** Offline tests for the badge renderer + placement detection. npm test */

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// --- htmlContainsBadge -------------------------------------------------------

test("detects the badge image embed", () => {
  const html = `<a href="https://www.boatyardjobs.com/employers/128"><img src="https://www.boatyardjobs.com/api/badge/128?style=navy"></a>`;
  assert.equal(htmlContainsBadge(html, 128), true);
});

test("detects a bare link to the employer page", () => {
  assert.equal(htmlContainsBadge(`<a href="/employers/42">Jobs</a>`, 42), true);
});

test("returns false when the badge is absent", () => {
  assert.equal(htmlContainsBadge(`<p>We are hiring! Call us.</p>`, 128), false);
});

test("does not match a different employer id by prefix", () => {
  // Employer 12 must not be matched by a reference to employer 128.
  const html = `<img src="https://www.boatyardjobs.com/api/badge/128">`;
  assert.equal(htmlContainsBadge(html, 12), false);
});

test("empty html is not a match", () => {
  assert.equal(htmlContainsBadge("", 5), false);
});

// --- renderBadge / styles ----------------------------------------------------

test("every catalogued style renders a sized SVG", () => {
  for (const s of BADGE_STYLES) {
    const svg = renderBadge(s.id, "Harborline Yachts", 6);
    assert.match(svg, /^<svg[\s\S]+<\/svg>$/, `${s.id} should be an svg`);
    assert.ok(svg.includes(`width="${s.w}"`), `${s.id} width`);
    assert.ok(svg.includes(`height="${s.h}"`), `${s.id} height`);
  }
});

test("unknown style falls back to the default", () => {
  assert.equal(badgeStyle("nope").id, BADGE_STYLES[0].id);
  assert.equal(renderBadge("nope", "X", 1), renderBadge(BADGE_STYLES[0].id, "X", 1));
});

test("full badge escapes the company name and pluralises the count", () => {
  const one = renderBadge("navy", "A & B Marine", 1);
  assert.ok(one.includes("A &amp; B Marine"), "escapes &");
  assert.ok(one.includes("1 open role"), "singular");
  const many = renderBadge("navy", "A & B Marine", 7);
  assert.ok(many.includes("7 open roles"), "plural");
});

test("company name is truncated on the full badge", () => {
  const svg = renderBadge("navy", "Superlong Company Name That Overflows Ltd", 3);
  assert.ok(svg.includes("…"), "should ellipsize long names");
});

console.log(`\n${passed} assertions passed.`);
