"use client";

/** Goes back to the listings the user came from, or /jobs if arrived directly. */
export default function BackToJobs() {
  function back() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/jobs";
  }
  return (
    <button
      type="button"
      onClick={back}
      className="text-sm font-medium text-navy-600 hover:underline"
    >
      ← Back to jobs
    </button>
  );
}
