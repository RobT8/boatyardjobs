import { cookies } from "next/headers";
import crypto from "crypto";
import { getAdvertiserByToken, type Advertiser } from "./ads";

/**
 * Advertiser accounts: email + password. The session cookie holds the
 * advertiser's login_token (an unguessable uuid), looked up server-side. Mirrors
 * the lightweight admin-auth approach; swap for Supabase Auth if it outgrows this.
 */
const COOKIE = "byj_advertiser";

/** scrypt hash, stored as "salt:hash" (both hex). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const expected = Buffer.from(hash, "hex");
  const got = crypto.scryptSync(password, salt, 64);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

export async function setAdvertiserSession(loginToken: string): Promise<void> {
  (await cookies()).set(COOKIE, loginToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAdvertiserSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** The logged-in advertiser, or null. */
export async function getSessionAdvertiser(): Promise<Advertiser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return getAdvertiserByToken(token);
}
