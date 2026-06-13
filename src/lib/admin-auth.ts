import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Minimal single-admin auth: a password (ADMIN_PASSWORD env) unlocks /admin by
 * setting an httpOnly cookie holding the password's SHA-256. No user table —
 * fine for one owner; swap for Supabase Auth if multiple admins are needed.
 */
const COOKIE = "byj_admin";

function expectedValue(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? crypto.createHash("sha256").update(pw).digest("hex") : null;
}

export function isAdminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

export async function isAdmin(): Promise<boolean> {
  const expected = expectedValue();
  if (!expected) return false;
  const got = (await cookies()).get(COOKIE)?.value ?? "";
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export function checkPassword(password: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(pw);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function setAdminCookie(): Promise<void> {
  const expected = expectedValue();
  if (!expected) return;
  (await cookies()).set(COOKIE, expected, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
