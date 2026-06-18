import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdvertiserAccountStep from "@/components/AdvertiserAccountStep";
import { getSessionAdvertiser } from "@/lib/advertiser-auth";

export const metadata: Metadata = {
  title: "Advertiser sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ autherror?: string; sent?: string; mode?: string; next?: string }>;
}

export default async function AdvertiseLoginPage({ searchParams }: Props) {
  const { autherror, sent, mode, next } = await searchParams;
  if (await getSessionAdvertiser()) redirect("/advertise/dashboard");

  const safeNext = next && next.startsWith("/advertise") ? next : "/advertise/dashboard";

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-800">Advertiser account</h1>
      <p className="mt-2 text-sm text-slate-600">
        Sign in to manage your adverts, or create an account to start advertising.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <AdvertiserAccountStep
          next={safeNext}
          autherror={autherror}
          sent={!!sent}
          defaultMode={mode === "register" ? "register" : "login"}
        />
      </div>
    </div>
  );
}
