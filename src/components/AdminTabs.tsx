"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Lightweight tab bar for the admin page. Tab contents are server-rendered and
 * passed in as nodes; this client wrapper only toggles which one is shown.
 * The active tab syncs with the URL hash (e.g. /admin#launch), so deep links and
 * the badge-missing email (which points at /admin#badge-deals) still work.
 */
export interface Tab {
  id: string;
  label: string;
  badge?: ReactNode;
  content: ReactNode;
}

export default function AdminTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    // Sync the active tab from the URL hash on mount (deep links / the
    // badge-missing email that points at /admin#launch). If the hash targets an
    // anchor inside a tab (e.g. #badge-deals) it simply won't match, and the
    // default tab stays active while the browser scrolls to the anchor.
    const fromHash = window.location.hash.replace("#", "");
    if (fromHash && tabs.some((t) => t.id === fromHash)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL hash is a browser-only side effect that can't run during SSR
      setActive(fromHash);
    }
  }, [tabs]);

  function select(id: string) {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="mt-6">
      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => select(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              active === t.id
                ? "border-brass-400 text-navy-800"
                : "border-transparent text-slate-500 hover:text-navy-700"
            }`}
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
