import { redirect } from "next/navigation";
import { createEmployerLead, type LeadInterest } from "@/lib/leads";
import { employerLeadNotificationHtml, isEmailEnabled, sendEmail } from "@/lib/email";

const INTERESTS = new Set<LeadInterest>(["feature", "claim", "general"]);

function backTo(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `/employers/feature?${qs}`;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const company = String(form.get("company") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const contact_name = String(form.get("contact_name") ?? "").trim() || null;
  const phone = String(form.get("phone") ?? "").trim() || null;
  const message = String(form.get("message") ?? "").trim() || null;
  const job_slug = String(form.get("job_slug") ?? "").trim() || null;
  const job_title = String(form.get("job_title") ?? "").trim() || null;
  const jobIdRaw = String(form.get("job_id") ?? "").trim();
  const job_id = /^\d+$/.test(jobIdRaw) ? parseInt(jobIdRaw, 10) : null;
  const interestRaw = String(form.get("interest") ?? "feature").trim() as LeadInterest;
  const interest: LeadInterest = INTERESTS.has(interestRaw) ? interestRaw : "feature";

  const carry: Record<string, string> = {};
  if (job_slug) carry.job = job_slug;

  if (!company || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect(backTo({ ...carry, error: "1" }));
  }

  await createEmployerLead({
    company,
    contact_name,
    email,
    phone,
    job_id,
    job_slug,
    job_title,
    interest,
    message,
  });

  // Best-effort internal notification; the lead is already stored regardless.
  const notify = process.env.LEADS_NOTIFY_EMAIL;
  if (notify && isEmailEnabled()) {
    try {
      await sendEmail({
        to: notify,
        subject: `New employer lead: ${company}`,
        html: employerLeadNotificationHtml({
          company,
          email,
          contact_name,
          phone,
          interest,
          job_title,
          job_slug,
          message,
        }),
      });
    } catch (err) {
      console.error("Failed to send employer lead notification:", err);
    }
  }

  redirect(backTo({ ...carry, sent: "1" }));
}
