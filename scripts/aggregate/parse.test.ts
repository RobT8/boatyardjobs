import assert from "node:assert/strict";
import {
  extractJobPostings,
  htmlToText,
  parseSalary,
  parseSalaryFromText,
  sanitizeSalaryUnit,
  jobPostingToInput,
  parseJobsFromHtml,
} from "./parse";
import { parseRobots, isPathAllowed } from "./robots";

const allowed = (txt: string, path: string) => isPathAllowed(parseRobots(txt), path);

/**
 * Offline tests for the JSON-LD parser. Run with: npm test
 * No network, no DB — pure fixtures, so it's safe in CI and pre-commit.
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

// A realistic page: site-level @graph plus a JobPosting in its own script tag.
const PAGE = `
<!doctype html><html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme Marine"}]}
</script>
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"JobPosting",
  "title":"Marine Diesel Technician",
  "description":"<p>Service <b>diesel</b> engines on yachts.</p><ul><li>ABYC Diesel preferred</li></ul>",
  "datePosted":"2026-05-01",
  "validThrough":"2026-08-01",
  "employmentType":"FULL_TIME",
  "hiringOrganization":{"@type":"Organization","name":"Harborline Yacht Services"},
  "jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Fort Lauderdale","addressRegion":"FL","addressCountry":"US"}},
  "baseSalary":{"@type":"MonetaryAmount","currency":"USD","value":{"@type":"QuantitativeValue","minValue":65000,"maxValue":95000,"unitText":"YEAR"}},
  "url":"https://acme.example/jobs/diesel-tech"
}
</script>
</head><body></body></html>`;

test("extractJobPostings finds postings, ignores Organization", () => {
  const postings = extractJobPostings(PAGE);
  assert.equal(postings.length, 1);
  assert.equal(postings[0].title, "Marine Diesel Technician");
});

test("htmlToText strips markup and entities", () => {
  assert.equal(htmlToText("<p>Hi&amp;<br>there</p>"), "Hi&\nthere");
});

test("parseSalary reads min/max yearly range", () => {
  const s = parseSalary({ value: { minValue: 65000, maxValue: 95000, unitText: "YEAR" } });
  assert.deepEqual(s, { salary_min: 65000, salary_max: 95000, salary_unit: "YEAR" });
});

test("parseSalary keeps hourly as hourly", () => {
  const s = parseSalary({ value: { value: 30, unitText: "HOUR" } });
  assert.deepEqual(s, { salary_min: 30, salary_max: 30, salary_unit: "HOUR" });
});

test("parseSalary annualizes monthly amounts", () => {
  const s = parseSalary({ value: { value: 5000, unitText: "MONTH" } });
  assert.deepEqual(s, { salary_min: 60000, salary_max: 60000, salary_unit: "YEAR" });
});

test("parseSalary treats an unlabelled hourly-magnitude figure as hourly", () => {
  // No unitText → defaults to YEAR, but $24 can only be an hourly rate.
  const s = parseSalary({ value: { minValue: 18, maxValue: 24 } });
  assert.deepEqual(s, { salary_min: 18, salary_max: 24, salary_unit: "HOUR" });
});

test("sanitizeSalaryUnit relabels low yearly figures, leaves real salaries alone", () => {
  assert.deepEqual(
    sanitizeSalaryUnit({ salary_min: 24, salary_max: 24, salary_unit: "YEAR" }),
    { salary_min: 24, salary_max: 24, salary_unit: "HOUR" }
  );
  assert.deepEqual(
    sanitizeSalaryUnit({ salary_min: 45000, salary_max: 70000, salary_unit: "YEAR" }),
    { salary_min: 45000, salary_max: 70000, salary_unit: "YEAR" }
  );
});

test("parseSalaryFromText reads an hourly range from prose", () => {
  const s = parseSalaryFromText("Compensation is $28 to $34 per hour depending on experience.");
  assert.deepEqual(s, { salary_min: 28, salary_max: 34, salary_unit: "HOUR" });
});

test("parseSalaryFromText reads an annual range with commas", () => {
  const s = parseSalaryFromText("We offer $65,000 - $85,000 per year plus benefits.");
  assert.deepEqual(s, { salary_min: 65000, salary_max: 85000, salary_unit: "YEAR" });
});

test("parseSalaryFromText expands a k suffix to annual", () => {
  const s = parseSalaryFromText("Salary $90k DOE.");
  assert.deepEqual(s, { salary_min: 90000, salary_max: 90000, salary_unit: "YEAR" });
});

test("parseSalaryFromText annualizes weekly and monthly pay", () => {
  assert.deepEqual(parseSalaryFromText("$1,200 per week"), {
    salary_min: 62400,
    salary_max: 62400,
    salary_unit: "YEAR",
  });
  assert.deepEqual(parseSalaryFromText("$5,000 a month"), {
    salary_min: 60000,
    salary_max: 60000,
    salary_unit: "YEAR",
  });
});

test("parseSalaryFromText demotes an hourly-magnitude figure labelled per year", () => {
  // "$30/year" is really an hourly rate; the magnitude guard fixes the unit.
  const s = parseSalaryFromText("Pay is $30 per year.");
  assert.deepEqual(s, { salary_min: 30, salary_max: 30, salary_unit: "HOUR" });
});

test("parseSalaryFromText ignores figures with no stated pay period", () => {
  assert.deepEqual(parseSalaryFromText("Sign-on bonus of $2,000 for new hires."), {
    salary_min: null,
    salary_max: null,
    salary_unit: "YEAR",
  });
  assert.deepEqual(parseSalaryFromText("Rates from $25-$35 (call for a quote)."), {
    salary_min: null,
    salary_max: null,
    salary_unit: "YEAR",
  });
});

test("parseSalaryFromText rejects implausible magnitudes", () => {
  assert.deepEqual(parseSalaryFromText("Manage a $5,000,000 annual budget."), {
    salary_min: null,
    salary_max: null,
    salary_unit: "YEAR",
  });
});

test("jobPostingToInput falls back to salary in the description", () => {
  const posting = {
    "@type": "JobPosting",
    title: "Marine Electrician",
    description: "Install and troubleshoot 12V systems. Pay is $32 to $40 per hour, full time.",
    hiringOrganization: { name: "Bay Electronics" },
    jobLocation: { address: { addressLocality: "Annapolis", addressRegion: "MD" } },
  };
  const job = jobPostingToInput(posting, { source: "x" });
  assert.equal(job!.salary_min, 32);
  assert.equal(job!.salary_max, 40);
  assert.equal(job!.salary_unit, "HOUR");
});

test("jobPostingToInput prefers structured baseSalary over prose", () => {
  const posting = {
    "@type": "JobPosting",
    title: "Rigger",
    description: "Great pay, up to $90k for the right person, standing rigging on yachts.",
    hiringOrganization: { name: "Rig Co" },
    jobLocation: { address: { addressLocality: "Newport", addressRegion: "RI" } },
    baseSalary: { value: { minValue: 55000, maxValue: 70000, unitText: "YEAR" } },
  };
  const job = jobPostingToInput(posting, { source: "x" });
  assert.equal(job!.salary_min, 55000);
  assert.equal(job!.salary_max, 70000);
});

test("jobPostingToInput maps a full posting", () => {
  const [posting] = extractJobPostings(PAGE);
  const job = jobPostingToInput(posting, { source: "acme", pageUrl: "https://acme.example/" });
  assert.ok(job);
  assert.equal(job!.title, "Marine Diesel Technician");
  assert.equal(job!.company, "Harborline Yacht Services");
  assert.equal(job!.city, "Fort Lauderdale");
  assert.equal(job!.state, "FL");
  assert.equal(job!.category, "marine-technician");
  assert.equal(job!.source, "acme");
  assert.equal(job!.source_url, "https://acme.example/jobs/diesel-tech");
  assert.deepEqual(job!.certifications, ["ABYC Diesel"]);
  assert.ok(!/[<>]/.test(job!.description), "description should be plain text");
});

test("full-name regions resolve to state codes", () => {
  const posting = {
    "@type": "JobPosting",
    title: "Marine Electrician",
    description: "Install NMEA 2000 networks and wiring on cruising yachts here.",
    hiringOrganization: { name: "Bay Electronics" },
    jobLocation: { address: { addressLocality: "Annapolis", addressRegion: "Maryland" } },
  };
  const job = jobPostingToInput(posting, { source: "x" });
  assert.equal(job!.state, "MD");
  assert.equal(job!.category, "marine-electrician");
});

test("non-US and incomplete postings are skipped", () => {
  const foreign = {
    "@type": "JobPosting",
    title: "Rigger",
    description: "Standing rigging on sailboats in the harbour every day of the week.",
    hiringOrganization: { name: "Euro Rig" },
    jobLocation: { address: { addressLocality: "Cowes", addressRegion: "Isle of Wight", addressCountry: "GB" } },
  };
  assert.equal(jobPostingToInput(foreign, { source: "x" }), null);
  assert.equal(jobPostingToInput({ "@type": "JobPosting", title: "x" }, { source: "x" }), null);
});

test("parseJobsFromHtml end-to-end yields normalized listings", () => {
  const jobs = parseJobsFromHtml(PAGE, { source: "acme", pageUrl: "https://acme.example/" });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].state, "FL");
});

test("ItemList of postings is flattened", () => {
  const html = `<script type="application/ld+json">
  {"@type":"ItemList","itemListElement":[
    {"@type":"ListItem","item":{"@type":"JobPosting","title":"Detailer","description":"Wash, wax and buff boats at the marina all season long.","hiringOrganization":{"name":"Shine Co"},"jobLocation":{"address":{"addressLocality":"Sarasota","addressRegion":"FL"}}}}
  ]}</script>`;
  const jobs = parseJobsFromHtml(html, { source: "x" });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].category, "detailer");
});

test("robots: empty / no rules allows everything", () => {
  assert.equal(allowed("", "/anything"), true);
  assert.equal(allowed("User-agent: *\nDisallow:", "/anything"), true);
});

test("robots: Disallow: / blocks all", () => {
  assert.equal(allowed("User-agent: *\nDisallow: /", "/v1/api"), false);
});

test("robots: only the named path is blocked", () => {
  const txt = "User-agent: *\nDisallow: /embed/";
  assert.equal(allowed(txt, "/embed/widget"), false);
  assert.equal(allowed(txt, "/v1/boards/acme/jobs"), true);
});

test("robots: longest match wins, Allow breaks ties", () => {
  const txt = "User-agent: *\nDisallow: /careers\nAllow: /careers/job";
  assert.equal(allowed(txt, "/careers/list"), false); // only Disallow matches
  assert.equal(allowed(txt, "/careers/job/123"), true); // longer Allow wins
});

test("robots: our token's group overrides the wildcard group", () => {
  const txt =
    "User-agent: *\nDisallow: /\n\nUser-agent: BoatyardJobsBot\nDisallow: /private/";
  assert.equal(allowed(txt, "/careers"), true); // our group, not the * block-all
  assert.equal(allowed(txt, "/private/x"), false);
});

test("robots: wildcard and end-anchor patterns", () => {
  assert.equal(allowed("User-agent: *\nDisallow: /*.pdf$", "/files/a.pdf"), false);
  assert.equal(allowed("User-agent: *\nDisallow: /*.pdf$", "/files/a.pdf?x=1"), true);
});

console.log(`\n${passed} assertions passed.`);
