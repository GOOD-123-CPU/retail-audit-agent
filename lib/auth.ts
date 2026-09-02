import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { env } from "@/lib/env";
import { SessionUser, UserRecord } from "@/lib/types";
import {
  authenticateUser,
  createUser,
  hashPassword,
  readUsers,
  updateUserRole,
  verifyPassword,
  writeUsers
} from "@/lib/user-store";

const secretKey = new TextEncoder().encode(env.jwtSecret);

function shouldUseSecureCookies() {
  try {
    const appUrl = new URL(env.appUrl);
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (appUrl.protocol !== "https:" && localHosts.has(appUrl.hostname)) {
      return false;
    }
  } catch {
    return process.env.NODE_ENV === "production";
  }

  return env.appUrl.startsWith("https://") || process.env.NODE_ENV === "production";
}

export {
  authenticateUser,
  createUser,
  hashPassword,
  readUsers,
  updateUserRole,
  verifyPassword,
  writeUsers
};

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySessionToken(token: string) {
  const verified = await jwtVerify(token, secretKey);
  return {
    id: String(verified.payload.id),
    email: String(verified.payload.email),
    name: String(verified.payload.name),
    role: verified.payload.role === "admin" ? "admin" : "user"
  } satisfies SessionUser;
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  return user;
}

export function toSessionUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}
