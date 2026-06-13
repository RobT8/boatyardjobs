import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin, isAdminConfigured } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-800">Admin sign in</h1>
      {!isAdminConfigured() && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Set an <code>ADMIN_PASSWORD</code> environment variable in Vercel to enable access.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Incorrect password.
        </p>
      )}
      <form action="/api/admin/login" method="post" className="mt-6 grid gap-3">
        <input
          type="password"
          name="password"
          required
          placeholder="Admin password"
          autoFocus
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-navy-800 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
