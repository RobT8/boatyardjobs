/**
 * Transactional email via Resend (https://resend.com).
 *
 * Uses the REST API directly (no SDK dependency). Set:
 *   RESEND_API_KEY      from resend.com (free tier)
 *   ALERTS_FROM_EMAIL   e.g. "BoatyardJobs <alerts@boatyardjobs.com>"
 *                       (must be a Resend-verified domain to email real users;
 *                       without a verified domain Resend only delivers to the
 *                       account owner from onboarding@resend.dev)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.ALERTS_FROM_EMAIL ?? "BoatyardJobs <onboarding@resend.dev>";

export function isEmailEnabled(): boolean {
  return !!RESEND_API_KEY;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

/** Base URL for links in emails. */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? "https://boatyardjobs.com").replace(/\/$/, "");
}

const wrap = (body: string) => `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <div style="background:#0f2942;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;font-weight:700;font-size:18px">
      BoatyardJobs
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px">
      ${body}
    </div>
  </div>`;

export function confirmEmailHtml(confirmUrl: string, unsubscribeUrl: string): string {
  return wrap(`
    <h1 style="font-size:18px;margin:0 0 12px">Confirm your job alert</h1>
    <p style="margin:0 0 16px;color:#334155">
      Tap below to confirm and start receiving new marine trades jobs by email.
      If you didn't request this, just ignore it — we won't email you again.
    </p>
    <p style="margin:0 0 20px">
      <a href="${confirmUrl}" style="background:#c79a3b;color:#1a1407;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:6px;display:inline-block">
        Confirm my alert
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8">
      Don't want this? <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe</a>.
    </p>`);
}

/** Internal heads-up to the team when an employer asks to feature/claim a listing. */
export function employerLeadNotificationHtml(lead: {
  company: string;
  email: string;
  contact_name?: string | null;
  phone?: string | null;
  interest: string;
  job_title?: string | null;
  job_slug?: string | null;
  message?: string | null;
}): string {
  const row = (label: string, value?: string | null) =>
    value ? `<p style="margin:0 0 6px"><strong>${label}:</strong> ${value}</p>` : "";
  const jobLink = lead.job_slug
    ? `<a href="${siteUrl()}/jobs/${lead.job_slug}">${lead.job_title ?? lead.job_slug}</a>`
    : lead.job_title ?? null;
  return wrap(`
    <h1 style="font-size:18px;margin:0 0 12px">New employer lead — ${lead.interest}</h1>
    ${row("Company", lead.company)}
    ${row("Contact", lead.contact_name)}
    ${row("Email", lead.email)}
    ${row("Phone", lead.phone)}
    ${row("Listing", jobLink)}
    ${row("Message", lead.message)}
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">
      Follow up from the BoatyardJobs admin dashboard.
    </p>`);
}

export interface DigestJob {
  title: string;
  company: string;
  city: string;
  stateName: string;
  url: string;
  salary: string | null;
}

export function digestEmailHtml(jobs: DigestJob[], unsubscribeUrl: string): string {
  const rows = jobs
    .map(
      (j) => `
      <tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7">
        <a href="${j.url}" style="color:#0f2942;font-weight:600;text-decoration:none;font-size:15px">${j.title}</a>
        <div style="color:#475569;font-size:13px;margin-top:2px">
          ${j.company} · ${j.city}, ${j.stateName}${j.salary ? ` · ${j.salary}` : ""}
        </div>
      </td></tr>`
    )
    .join("");
  return wrap(`
    <h1 style="font-size:18px;margin:0 0 4px">New marine trades jobs for you</h1>
    <p style="margin:0 0 16px;color:#334155">${jobs.length} new listing${jobs.length === 1 ? "" : "s"} matching your alert:</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">
      You're getting this because you signed up for BoatyardJobs alerts.
      <a href="${unsubscribeUrl}" style="color:#94a3b8">Unsubscribe</a>.
    </p>`);
}
