import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminAuth } from "./firebase/admin";

// Name of the httpOnly cookie that holds the Firebase session cookie.
export const SESSION_COOKIE = "vc_session";

// Single chokepoint for "who is the caller?" Every protected API route uses
// this, so swapping the auth provider only touches this file.
//
// We verify the Firebase *session cookie* (minted in /api/auth/session) rather
// than a raw ID token: session cookies are longer-lived, revocable, and don't
// require the client to refresh an hourly token on every request.
export async function getUserId(): Promise<string | null> {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    // checkRevoked=true so a signed-out / disabled user is rejected immediately.
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function requireUserId(): Promise<{ userId: string } | NextResponse> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return { userId };
}
