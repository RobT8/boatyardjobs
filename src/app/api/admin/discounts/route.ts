import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createDiscountCode, setDiscountActive } from "@/lib/discounts";

/** Admin creates a discount code, or toggles one active/inactive. */
export async function POST(req: Request) {
  if (!(await isAdmin())) redirect("/admin/login");
  const form = await req.formData();
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const action = get("action");

  if (action === "toggle") {
    const id = Number(get("id"));
    if (id) await setDiscountActive(id, get("active") === "1");
    redirect("/admin?discount_toggled=1");
  }

  // Default: create.
  const code = get("code");
  const percent = parseInt(get("percent_off"), 10);
  const appliesTo = get("applies_to");
  const maxUsesRaw = get("max_uses");
  const fromRaw = get("valid_from");
  const untilRaw = get("valid_until");

  const valid =
    /^[A-Za-z0-9_-]{2,40}$/.test(code) &&
    Number.isInteger(percent) &&
    percent >= 1 &&
    percent <= 100 &&
    ["jobs", "ads", "both"].includes(appliesTo);
  if (!valid) redirect("/admin?discount_error=1");

  try {
    await createDiscountCode({
      code,
      percent_off: percent,
      applies_to: appliesTo as "jobs" | "ads" | "both",
      valid_from: fromRaw ? new Date(fromRaw).toISOString() : null,
      valid_until: untilRaw ? new Date(untilRaw).toISOString() : null,
      max_uses: maxUsesRaw && Number.isFinite(Number(maxUsesRaw)) ? Number(maxUsesRaw) : null,
    });
  } catch {
    // Most likely a duplicate code (unique constraint).
    redirect("/admin?discount_error=1");
  }
  redirect("/admin?discount_added=1");
}
