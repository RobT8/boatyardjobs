import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import PageViewTracker from "@/components/PageViewTracker";
import NavMenu from "@/components/NavMenu";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://boatyardjobs.com"),
  title: {
    default: "BoatyardJobs — Marine Trades Jobs in the US",
    template: "%s | BoatyardJobs",
  },
  description:
    "Marine trades jobs from across the US, in one place: marine technicians, electricians, riggers, yard staff and more at boatyards, marinas and dealerships nationwide.",
  // Google Search Console ownership check. Set GOOGLE_SITE_VERIFICATION to the
  // token Google gives you (HTML-tag method); omitted in envs where it's unset.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

function SiteHeader() {
  return (
    <header className="bg-navy-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span aria-hidden className="text-brass-400">⚓</span>
          Boatyard<span className="text-brass-400">Jobs</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm sm:gap-6">
          <NavMenu
            label="Employers"
            links={[
              ["Why post here", "/employers"],
              ["Post a job", "/post-a-job"],
              ["Feature your listings", "/employers/feature"],
              ["My listings", "/employers/dashboard"],
              ["My profile", "/employers/profile"],
              ["Sign in", "/employers/login"],
            ]}
          />
          <NavMenu
            label="Candidates"
            links={[
              ["Browse jobs", "/jobs"],
              ["Salary guides", "/salary"],
              ["Job alerts", "/alerts"],
            ]}
          />
          <NavMenu
            label="Advertise"
            links={[
              ["Book advertising", "/advertise"],
              ["Advertising guidelines", "/advertise/guidelines"],
              ["My dashboard", "/advertise/dashboard"],
              ["My profile", "/advertise/profile"],
              ["Sign in", "/advertise/login"],
            ]}
          />
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 bg-navy-900 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-white">
            Boatyard<span className="text-brass-400">Jobs</span>
          </p>
          <p className="mt-2 text-slate-400">
            The job board for the recreational marine trades — built for the people who keep
            boats running.
          </p>
        </div>
        <div>
          <p className="font-semibold text-white">For Candidates</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/jobs" className="hover:text-brass-400">Browse all jobs</Link></li>
            <li><Link href="/salary" className="hover:text-brass-400">Salary guides</Link></li>
            <li><Link href="/alerts" className="hover:text-brass-400">Set up job alerts</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white">For Employers</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/employers" className="hover:text-brass-400">Why post here</Link></li>
            <li><Link href="/post-a-job" className="hover:text-brass-400">Post a job</Link></li>
            <li><Link href="/employers/feature" className="hover:text-brass-400">Feature your listings</Link></li>
            <li><Link href="/advertise" className="hover:text-brass-400">Advertise with us</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-700 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} BoatyardJobs
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geist.className} flex min-h-full flex-col`}>
        <PageViewTracker />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
