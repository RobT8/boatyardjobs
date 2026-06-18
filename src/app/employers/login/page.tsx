import type { Metadata } from "next";
import { redirect } from "next/navigation";
import EmployerAccountStep from "@/components/EmployerAccountStep";
import { getSessionEmployer } from "@/lib/employer-auth";

export const metadata: Metadata = {
  title: "Employer sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ autherror?: string; sent?: string; mode?: string; next?: string }>;
}

export default async function EmployerLoginPage({ searchParams }: Props) {
  const { autherror, sent, mode, next } = await searchParams;
  if (await getSessionEmployer()) redirect("/employers/dashboard");

  const safeNext =
    next && (next.startsWith("/post-a-job") || next.startsWith("/employers"))
      ? next
      : "/employers/dashboard";

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-800">Employer account</h1>
      <p className="mt-2 text-sm text-slate-600">
        Sign in to manage your listings, or create an account to post a job.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <EmployerAccountStep
          next={safeNext}
          autherror={autherror}
          sent={!!sent}
          defaultMode={mode === "register" ? "register" : "login"}
        />
      </div>
    </div>
  );
}
