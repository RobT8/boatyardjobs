import assert from "node:assert/strict";
import { jobPostingJsonLd, type Job } from "../src/lib/jobs";

/**
 * Offline tests for the schema.org JobPosting builder. Pure (no DB/network).
 * Run with: npm test
 */

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

/** A direct listing with everything populated. */
function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 42,
    slug: "marine-diesel-tech-acme-fort-lauderdale-fl",
    title: "Marine Diesel Technician",
    company: "Acme Marine",
    city: "Fort Lauderdale",
    state: "FL",
    category: "technician",
    employment_type: "FULL_TIME",
    description: "Service inboard diesels. Requirements ABYC certification preferred.",
    salary_min: 60000,
    salary_max: 85000,
    salary_unit: "YEAR",
    certifications: [],
    street_address: "123 Harbor Dr",
    postal_code: "33301",
    source: "direct",
    source_url: null,
    apply_email: "jobs@acme.example",
    featured: 0,
    listing_rank: 1,
    status: "published",
    posted_at: "2026-06-01T12:00:00.000Z",
    expires_at: "2026-07-01T12:00:00.000Z",
    employer_id: 1,
    ...overrides,
  };
}

test("emits the required JobPosting fields", () => {
  const ld = jobPostingJsonLd(makeJob());
  assert.equal(ld["@type"], "JobPosting");
  assert.equal(ld.title, "Marine Diesel Technician");
  assert.equal(ld.datePosted, "2026-06-01");
  assert.equal(ld.employmentType, "FULL_TIME");
  assert.ok(ld.hiringOrganization);
  assert.ok(ld.jobLocation);
});

test("always sets validThrough (from expires_at when present)", () => {
  const ld = jobPostingJsonLd(makeJob());
  assert.equal(ld.validThrough, "2026-07-01");
});

test("validThrough falls back to posted_at + age cap for feed jobs", () => {
  const ld = jobPostingJsonLd(makeJob({ expires_at: null, source: "adzuna" }));
  // posted 2026-06-01 + 9 months => 2027-03-01
  assert.equal(ld.validThrough, "2027-03-01");
});

test("description is rendered as HTML paragraphs", () => {
  const ld = jobPostingJsonLd(makeJob());
  assert.match(String(ld.description), /^<p>.*<\/p>$/s);
  // The "Requirements" section heading forces a paragraph break.
  assert.ok(String(ld.description).includes("</p><p>"));
});

test("includes streetAddress and postalCode when present", () => {
  const ld = jobPostingJsonLd(makeJob());
  const addr = (ld.jobLocation as { address: Record<string, unknown> }).address;
  assert.equal(addr.streetAddress, "123 Harbor Dr");
  assert.equal(addr.postalCode, "33301");
  assert.equal(addr.addressLocality, "Fort Lauderdale");
  assert.equal(addr.addressRegion, "FL");
});

test("omits streetAddress and postalCode when absent (feed jobs)", () => {
  const ld = jobPostingJsonLd(makeJob({ street_address: null, postal_code: null }));
  const addr = (ld.jobLocation as { address: Record<string, unknown> }).address;
  assert.ok(!("streetAddress" in addr));
  assert.ok(!("postalCode" in addr));
  // City/state/country still present.
  assert.equal(addr.addressCountry, "US");
});

test("enriches hiringOrganization with branding when provided", () => {
  const ld = jobPostingJsonLd(makeJob(), {
    website: "https://acme.example",
    logo: "https://acme.example/logo.png",
  });
  const org = ld.hiringOrganization as Record<string, unknown>;
  assert.equal(org.name, "Acme Marine");
  assert.equal(org.sameAs, "https://acme.example");
  assert.equal(org.logo, "https://acme.example/logo.png");
});

test("omits sameAs/logo when branding is absent", () => {
  const ld = jobPostingJsonLd(makeJob());
  const org = ld.hiringOrganization as Record<string, unknown>;
  assert.ok(!("sameAs" in org));
  assert.ok(!("logo" in org));
});

test("includes baseSalary when a salary is set, omits it otherwise", () => {
  const withSalary = jobPostingJsonLd(makeJob());
  assert.ok(withSalary.baseSalary);
  const noSalary = jobPostingJsonLd(makeJob({ salary_min: null, salary_max: null }));
  assert.ok(!("baseSalary" in noSalary));
});

test("directApply reflects the listing source", () => {
  assert.equal(jobPostingJsonLd(makeJob()).directApply, true);
  assert.equal(jobPostingJsonLd(makeJob({ source: "adzuna" })).directApply, false);
});

console.log(`\n${passed} assertions passed.`);
