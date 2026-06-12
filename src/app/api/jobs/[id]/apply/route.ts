import { redirect } from "next/navigation";
import { getJobById, recordApplyClick } from "@/lib/jobs";

/**
 * The apply click is the board's core metric: it's what we report to employers
 * ("your listing got N apply clicks"). Track, then send the candidate onward —
 * to the original listing for aggregated jobs, or mailto for direct posts.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const job = await getJobById(Number(id));
  if (!job) redirect("/jobs");

  await recordApplyClick(job.id);

  if (job.source_url) redirect(job.source_url);
  if (job.apply_email)
    redirect(`mailto:${job.apply_email}?subject=${encodeURIComponent(`Application: ${job.title}`)}`);
  redirect(`/jobs/${job.slug}?apply=direct`);
}
