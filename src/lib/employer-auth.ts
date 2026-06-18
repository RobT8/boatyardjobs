import { cookies } from "next/headers";
import { getEmployerByToken, type Employer } from "./employers";

// Password hashing is shared with the advertiser side.
export { hashPassword, verifyPassword } from "./advertiser-auth";

/** Employer session: an httpOnly cookie holding the employer's login_token. */
const COOKIE = "byj_employer";

export async function setEmployerSession(loginToken: string): Promise<void> {
  (await cookies()).set(COOKIE, loginToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearEmployerSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionEmployer(): Promise<Employer | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return getEmployerByToken(token);
}
