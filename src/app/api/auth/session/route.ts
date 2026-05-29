import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase/admin";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs"; // firebase-admin needs node, not edge

// Session cookie lifetime. Firebase caps this at 14 days; 5 is a reasonable
// balance between not-nagging and limiting the blast radius of a stolen cookie.
const EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

const Body = z.object({ idToken: z.string().min(20) });

// POST /api/auth/session
// Called by the client right after a successful Firebase sign-in. We:
//   1. verify the freshly-minted ID token
//   2. mint a long-lived session cookie from it
//   3. upsert the local User row so foreign keys resolve
//   4. set the cookie httpOnly so JS can't read it (XSS-resistant)
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });

  const auth = adminAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(parsed.data.idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Keep the local mirror in sync with whatever Firebase knows about the user.
  await prisma.user.upsert({
    where: { id: decoded.uid },
    create: {
      id: decoded.uid,
      email: decoded.email ?? `${decoded.uid}@no-email.local`,
      name: (decoded.name as string | undefined) ?? null,
    },
    update: {
      email: decoded.email ?? undefined,
      name: (decoded.name as string | undefined) ?? undefined,
    },
  });

  const sessionCookie = await auth.createSessionCookie(parsed.data.idToken, {
    expiresIn: EXPIRES_IN_MS,
  });

  // Mark the cookie Secure only on real HTTPS connections. Tying this to
  // NODE_ENV breaks `npm start` over http://localhost (browsers silently drop
  // Secure cookies on plain HTTP, leaving the user unauthenticated server-side).
  // Vercel terminates TLS and forwards x-forwarded-proto=https, so prod stays Secure.
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const secure = proto === "https";

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: EXPIRES_IN_MS / 1000,
  });
  return res;
}

// DELETE /api/auth/session — sign out. Clears the cookie.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
