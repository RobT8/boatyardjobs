import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { publishPendingJob, rejectPendingJob } from "@/lib/jobs";
import { notifyJobLive } from "@/lib/google-indexing";

/**
 * Admin moderates a free/reviewed submission. `id` is the job id; `action` is
 * `approve` (publish now, 30-day run) or `reject` (retire it). Only pending jobs
 * are affected (the lib fns guard on status), so this is safe to re-post.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { id } = await params;
  const jobId = parseInt(id, 10);
  if (!Number.isFinite(jobId)) redirect("/admin?job_error=1#pending");

  const form = await req.formData();
  const action = String(form.get("action") ?? "");

  if (action === "approve") {
    const slug = await publishPendingJob(jobId);
    if (slug) await notifyJobLive(slug); // live now → nudge Google (no-op unless configured)
    redirect("/admin?job_approved=1#pending");
  }
  if (action === "reject") {
    await rejectPendingJob(jobId);
    redirect("/admin?job_rejected=1#pending");
  }
  redirect("/admin#pending");
}
