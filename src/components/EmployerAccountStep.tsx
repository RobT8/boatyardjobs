"use client";

import { useState } from "react";

interface Props {
  next: string;
  autherror?: string;
  sent?: boolean;
  defaultMode?: "login" | "register";
}

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none";

const ERRORS: Record<string, string> = {
  invalid: "Please enter a company name, a valid email, and a password of at least 8 characters.",
  exists: "An account with that email already exists — please sign in instead.",
  badlogin: "Email or password not recognised.",
  badlink: "That sign-in link is invalid or has expired.",
};

export default function EmployerAccountStep({ next, autherror, sent, defaultMode }: Props) {
  const [mode, setMode] = useState<"login" | "register">(defaultMode ?? "login");
  const [forgot, setForgot] = useState(false);

  return (
    <div>
      <div className="mb-5 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
            mode === "login" ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
            mode === "register" ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          Create account
        </button>
      </div>

      {autherror && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {ERRORS[autherror] ?? "Something went wrong — please try again."}
        </p>
      )}
      {sent && (
        <p className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          If that email has an account, we&apos;ve sent a sign-in link. Check your inbox.
        </p>
      )}

      {mode === "login" && !forgot && (
        <form action="/api/employer/login" method="post" className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <input name="email" type="email" required placeholder="Email" className={inputCls} />
          <input name="password" type="password" required placeholder="Password" className={inputCls} />
          <button
            type="submit"
            className="w-full rounded-md bg-brass-400 px-6 py-2.5 font-semibold text-navy-900 hover:bg-brass-500"
          >
            Sign in &amp; continue
          </button>
          <button
            type="button"
            onClick={() => setForgot(true)}
            className="block text-xs text-navy-600 hover:underline"
          >
            Forgot your password? Email me a sign-in link
          </button>
        </form>
      )}

      {mode === "login" && forgot && (
        <form action="/api/employer/magic-link" method="post" className="space-y-3">
          <p className="text-sm text-slate-600">
            We&apos;ll email you a one-time sign-in link. You can set a new password once you&apos;re in.
          </p>
          <input name="email" type="email" required placeholder="Email" className={inputCls} />
          <button
            type="submit"
            className="w-full rounded-md bg-brass-400 px-6 py-2.5 font-semibold text-navy-900 hover:bg-brass-500"
          >
            Email me a link
          </button>
          <button
            type="button"
            onClick={() => setForgot(false)}
            className="block text-xs text-navy-600 hover:underline"
          >
            ← Back to sign in
          </button>
        </form>
      )}

      {mode === "register" && (
        <form action="/api/employer/register" method="post" className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <input name="company" required placeholder="Company" className={inputCls} />
          <input name="email" type="email" required placeholder="Email" className={inputCls} />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Password (8+ characters)"
            className={inputCls}
          />
          <button
            type="submit"
            className="w-full rounded-md bg-brass-400 px-6 py-2.5 font-semibold text-navy-900 hover:bg-brass-500"
          >
            Create account &amp; continue
          </button>
        </form>
      )}
    </div>
  );
}
