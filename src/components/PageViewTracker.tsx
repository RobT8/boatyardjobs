"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Fires a lightweight pageview beacon on each route change (excludes /admin). */
export default function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, referrer: document.referrer || "" }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}
